const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Pool } = require('pg');
const http = require('http');
const socketIo = require('socket.io');
const { initializeDatabase } = require('./db-init');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// Database configuration
const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
let db;

if (isPostgres) {
  console.log('🐘 Configurazione PostgreSQL per Render...');
  
  // Configurazione ottimizzata per PostgreSQL su Render (free tier)
  // Basata su soluzioni per "Connection terminated unexpectedly"
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    // Configurazioni ottimizzate per evitare "Connection terminated unexpectedly"
    max: 3,                        // Ridotto a 3 connessioni per free tier
    min: 0,                        // 0 connessioni minime per evitare timeout
    idleTimeoutMillis: 0,          // Mai timeout per connessioni idle
    connectionTimeoutMillis: 0,    // Mai timeout per nuove connessioni
    acquireTimeoutMillis: 8000,    // 8 secondi per acquisire connessione
    createTimeoutMillis: 8000,     // 8 secondi per creare connessione
    statement_timeout: 0,          // Mai timeout per statement
    query_timeout: 0,              // Mai timeout per query
    keepAlive: true,               // Mantieni connessioni attive
    keepAliveInitialDelayMillis: 10000, // Delay iniziale keep-alive
    // Configurazioni specifiche per Render
    application_name: 'motta-carrozzeria',
    connect_timeout: 60,           // 60 secondi per connessione iniziale
    // Configurazioni aggiuntive per stabilità
    reapIntervalMillis: 1000,      // Controllo connessioni ogni secondo
    createRetryIntervalMillis: 100, // Retry ogni 100ms
  });

  // Gestione eventi del pool per debugging
  pool.on('connect', (client) => {
    console.log('✅ Nuova connessione PostgreSQL stabilita');
  });

  pool.on('error', (err, client) => {
    console.error('❌ Errore nel pool PostgreSQL:', err.message);
  });

  pool.on('remove', (client) => {
    console.log('🔄 Connessione PostgreSQL rimossa dal pool');
  });

  db = pool;
  
  console.log('✅ Pool PostgreSQL configurato per Render con gestione errori migliorata');
} else {
  console.log('📁 Usando SQLite come fallback...');
  const dbPath = path.join(__dirname, '..', 'database.db');
  db = new sqlite3.Database(dbPath);
  console.log('✅ Database SQLite inizializzato');
}

// Health check endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: isPostgres ? 'PostgreSQL' : 'SQLite'
  });
});

// Database health check with retry mechanism
async function checkDatabaseHealth() {
  const maxRetries = 5;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      if (isPostgres) {
        const result = await db.query('SELECT NOW() as current_time');
        console.log('✅ PostgreSQL health check passed:', result.rows[0].current_time);
        return true;
      } else {
        return new Promise((resolve, reject) => {
          db.get('SELECT datetime("now") as current_time', (err, row) => {
            if (err) reject(err);
            else {
              console.log('✅ SQLite health check passed:', row.current_time);
              resolve(true);
            }
          });
        });
      }
    } catch (error) {
      retryCount++;
      console.log(`❌ Database health check failed (attempt ${retryCount}/${maxRetries}):`, error.message);
      
      if (retryCount < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.log('❌ Database health check failed after all retries');
  return false;
}

// Initialize database tables with retry mechanism
async function initializeTables() {
  console.log('🏗️ Initializing database tables...');
  
  if (isPostgres) {
    const maxRetries = 5;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`📡 PostgreSQL table initialization attempt ${retryCount + 1}/${maxRetries}`);
        
        // Users table
        await db.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Jobs table
        await db.query(`
          CREATE TABLE IF NOT EXISTS jobs (
            id SERIAL PRIMARY KEY,
            job_number VARCHAR(255) UNIQUE NOT NULL,
            customer_id INTEGER NOT NULL,
            vehicle_info TEXT NOT NULL,
            description TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            priority VARCHAR(50) DEFAULT 'medium',
            estimated_hours DECIMAL(10,2) DEFAULT 0,
            actual_hours DECIMAL(10,2) DEFAULT 0,
            created_by INTEGER NOT NULL,
            assigned_to INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (assigned_to) REFERENCES users(id)
          )
        `);

        // Time logs table
        await db.query(`
          CREATE TABLE IF NOT EXISTS time_logs (
            id SERIAL PRIMARY KEY,
            job_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            duration_minutes INTEGER DEFAULT 0,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `);

        // Calendar events table
        await db.query(`
          CREATE TABLE IF NOT EXISTS calendar_events (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            start_date TIMESTAMP NOT NULL,
            end_date TIMESTAMP NOT NULL,
            job_id INTEGER,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `);

        // Employees table
        await db.query(`
          CREATE TABLE IF NOT EXISTS employees (
            id SERIAL PRIMARY KEY,
            employee_code VARCHAR(255) UNIQUE NOT NULL,
            first_name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255) NOT NULL,
            position VARCHAR(255) NOT NULL,
            department VARCHAR(255),
            hire_date DATE NOT NULL,
            hourly_rate DECIMAL(10,2) DEFAULT 0,
            phone VARCHAR(50),
            address TEXT,
            status VARCHAR(50) DEFAULT 'active',
            user_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `);

        // Customers table
        await db.query(`
          CREATE TABLE IF NOT EXISTS customers (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        console.log('✅ PostgreSQL tables initialized successfully');
        return true;
        
      } catch (error) {
        retryCount++;
        console.log(`❌ PostgreSQL table initialization failed (attempt ${retryCount}/${maxRetries}):`, error.message);
        
        if (retryCount < maxRetries) {
          const waitTime = Math.min(5000 + (retryCount * 3000), 30000); // Progressive wait: 5s, 8s, 11s, 14s, 17s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    console.log('❌ PostgreSQL table initialization failed after all retries, proceeding anyway...');
    return false;
  } else {
    // SQLite table creation (existing code)
    return new Promise((resolve) => {
      db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Jobs table
        db.run(`CREATE TABLE IF NOT EXISTS jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_number TEXT UNIQUE NOT NULL,
          customer_id INTEGER NOT NULL,
          vehicle_info TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          priority TEXT DEFAULT 'medium',
          estimated_hours REAL DEFAULT 0,
          actual_hours REAL DEFAULT 0,
          created_by INTEGER NOT NULL,
          assigned_to INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (assigned_to) REFERENCES users(id)
        )`);

        // Time logs table
        db.run(`CREATE TABLE IF NOT EXISTS time_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          duration_minutes INTEGER DEFAULT 0,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Calendar events table
        db.run(`CREATE TABLE IF NOT EXISTS calendar_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          start_date DATETIME NOT NULL,
          end_date DATETIME NOT NULL,
          job_id INTEGER,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Employees table
        db.run(`CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_code TEXT UNIQUE NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          position TEXT NOT NULL,
          department TEXT,
          hire_date DATE NOT NULL,
          hourly_rate REAL DEFAULT 0,
          phone TEXT,
          address TEXT,
          status TEXT DEFAULT 'active',
          user_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Customers table
        db.run(`CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
          console.log('✅ SQLite tables initialized successfully');
          resolve(true);
        });
      });
    });
  }
}

// Initialize database on startup
(async () => {
  console.log('🚀 Starting Motta 5 Server...');
  
  if (isPostgres) {
    try {
      console.log('🔄 Initializing PostgreSQL database...');
      await initializeDatabase();
      console.log('✅ Database initialization completed');
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      console.log('⚠️ Proceeding with fallback initialization...');
      
      // Fallback to existing initialization
      const healthCheck = await checkDatabaseHealth();
      if (!healthCheck) {
        console.log('⚠️ Database health check failed, but proceeding with table initialization...');
      }
      await initializeTables();
    }
  } else {
    // Check database health first
    const healthCheck = await checkDatabaseHealth();
    if (!healthCheck && isPostgres) {
      console.log('⚠️ Database health check failed, but proceeding with table initialization...');
    }
    
    // Initialize tables
    await initializeTables();
  }
})();

module.exports = { app, server, db };