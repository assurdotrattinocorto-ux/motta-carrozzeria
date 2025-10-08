const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Configurazione per ambiente di test
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.DATABASE_PATH = path.join(__dirname, '..', 'test_database.db');

// Timeout globale per i test
jest.setTimeout(10000);

// Mock console per ridurre output durante i test
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Funzione helper per creare database di test pulito
global.createTestDatabase = () => {
  const testDbPath = process.env.DATABASE_PATH;
  
  // Rimuovi database di test esistente
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(testDbPath);
    
    // Crea tabelle di test
    const createTables = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'employee',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        assigned_to INTEGER,
        created_by INTEGER NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        customer_email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assigned_at DATETIME,
        completed_at DATETIME,
        archived_at DATETIME,
        FOREIGN KEY (assigned_to) REFERENCES users (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      );
      
      CREATE TABLE IF NOT EXISTS time_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        active BOOLEAN DEFAULT 1,
        work_date DATE,
        FOREIGN KEY (job_id) REFERENCES jobs (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
      
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        event_time TIME,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
      );
      
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        code TEXT UNIQUE,
        name TEXT NOT NULL,
        surname TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
      
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    db.exec(createTables, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Inserisci dati di test
      const bcrypt = require('bcryptjs');
      const adminPassword = bcrypt.hashSync('admin123', 10);
      const employeePassword = bcrypt.hashSync('dipendente123', 10);
      
      const insertTestData = `
        INSERT INTO users (email, password, role) VALUES 
        ('admin@test.com', '${adminPassword}', 'admin'),
        ('employee@test.com', '${employeePassword}', 'employee');
        
        INSERT INTO customers (name, email, phone) VALUES 
        ('Test Customer', 'customer@test.com', '1234567890');
        
        INSERT INTO employees (user_id, code, name, surname, email) VALUES 
        (2, 'EMP001', 'Test', 'Employee', 'employee@test.com');
      `;
      
      db.exec(insertTestData, (err) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

// Funzione helper per pulire database di test
global.cleanTestDatabase = () => {
  const testDbPath = process.env.DATABASE_PATH;
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
};