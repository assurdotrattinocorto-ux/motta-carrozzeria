const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { DatabaseBackupSystem } = require(path.join(__dirname, '..', 'backup_system'));
require('dotenv').config();

const app = express();
const server = http.createServer(app);
// Configurazione CORS per permettere connessioni da più origini
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://motta-carrozzeria-jg5q.onrender.com"
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permetti richieste senza origin (es. app mobile) o da origini consentite
    // Durante lo sviluppo, permetti anche localhost con qualsiasi porta
    if (!origin || allowedOrigins.includes(origin) || 
        (origin && origin.startsWith('http://localhost:')) ||
        (origin && origin.startsWith('http://127.0.0.1:'))) {
      callback(null, true);
    } else {
      callback(new Error('Non permesso da CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
};

const io = socketIo(server, {
  cors: corsOptions
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'motta_carrozzeria_secret_key_2024';

// Multer configuration for photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'job-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file immagine sono permessi!'), false);
    }
  }
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  // Configurazione percorsi per build e index.html
  const isRender = process.env.RENDER === 'true';
  const buildPath = isRender 
    ? path.join(__dirname, '..', 'client', 'build')  // Su Render: /opt/render/project/client/build
    : path.join(__dirname, '..', 'client', 'build'); // In locale: client/build
  
  console.log('🔍 Build path:', buildPath);
  console.log('🔍 Is Render:', isRender);
  app.use(express.static(buildPath));
}

// Database setup
let db;
const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '' && process.env.DATABASE_URL.includes('postgres');

if (isPostgres) {
  // PostgreSQL setup
  const { Pool } = require('pg');
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // Enhanced connection pool settings for Render
    max: 20, // Maximum number of clients in the pool
    min: 2,  // Minimum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
    acquireTimeoutMillis: 60000, // Return an error after 60 seconds if a client could not be checked out
    statement_timeout: 30000, // Number of milliseconds before a statement in query will time out
    query_timeout: 30000, // Number of milliseconds before a query call will timeout
    keepAlive: true, // Enable TCP keep-alive
    keepAliveInitialDelayMillis: 10000, // TCP keep-alive delay
  });
  
  // Handle pool errors
  db.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err);
  });
  
  db.on('connect', (client) => {
    console.log('✅ New PostgreSQL client connected');
  });
  
  db.on('remove', (client) => {
    console.log('🔌 PostgreSQL client removed from pool');
  });
  
  console.log('🐘 Using PostgreSQL database with enhanced connection pool');
} else {
  // SQLite setup (fallback)
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database.db');
  db = new sqlite3.Database(dbPath);
  console.log('📁 Using SQLite database');
}

// Database wrapper functions to handle both PostgreSQL and SQLite
function dbGet(query, params, callback) {
  if (isPostgres) {
    db.query(query, params)
      .then(result => {
        callback(null, result.rows[0] || null);
      })
      .catch(err => {
        callback(err);
      });
  } else {
    db.get(query, params, callback);
  }
}

function dbAll(query, params, callback) {
  if (isPostgres) {
    db.query(query, params)
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => {
        callback(err);
      });
  } else {
    db.all(query, params, callback);
  }
}

function dbRun(query, params, callback) {
  if (isPostgres) {
    db.query(query, params)
      .then(result => {
        callback(null, { lastID: result.insertId, changes: result.rowCount });
      })
      .catch(err => {
        callback(err);
      });
  } else {
    db.run(query, params, callback);
  }
}

// Helper function to get job with all assigned employees
function getJobWithAssignments(jobId, callback) {
  dbGet(`
    SELECT j.*, 
           c.name as created_by_name
    FROM jobs j
    LEFT JOIN users c ON j.created_by = c.id
    WHERE j.id = ?
  `, [jobId], (err, job) => {
    if (err) {
      return callback(err);
    }

    if (!job) {
      return callback(new Error('Job not found'));
    }

    // Get all assigned employees for this job
    dbAll(`
      SELECT u.id, u.name, ja.assigned_at
      FROM job_assignments ja
      JOIN users u ON ja.user_id = u.id
      WHERE ja.job_id = ?
      ORDER BY ja.assigned_at
    `, [jobId], (err, assignments) => {
      if (err) {
        return callback(err);
      }

      // Add assigned employees to job object
      job.assigned_employees = assignments || [];
      
      // For backward compatibility, set assigned_to to first employee's ID if exists
      job.assigned_to = assignments && assignments.length > 0 ? assignments[0].id : null;
      job.assigned_to_name = assignments && assignments.length > 0 ? assignments[0].name : null;

      callback(null, job);
    });
  });
}

// Initialize database tables with retry mechanism
// Database health check function
async function checkDatabaseHealth() {
  if (!isPostgres) return true;
  
  try {
    console.log('🏥 Performing database health check...');
    
    // Test basic connectivity
    const result = await db.query('SELECT version() as version, current_timestamp as timestamp');
    console.log('✅ Database is responsive');
    console.log(`📊 PostgreSQL version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    
    // Test connection pool status
    console.log(`🔗 Connection pool - Total: ${db.totalCount}, Idle: ${db.idleCount}, Waiting: ${db.waitingCount}`);
    
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    return false;
  }
}

async function initializeTables() {
  if (isPostgres) {
    // Perform initial health check
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      console.log('⚠️ Initial health check failed, but proceeding with table initialization...');
    }
    
    // PostgreSQL table creation with enhanced retry logic
    const maxRetries = 5; // Increased from 3 to 5
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`🔄 Attempting to initialize PostgreSQL tables (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Enhanced connection test with timeout
        const connectionTest = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection test timeout'));
          }, 15000); // 15 second timeout
          
          db.query('SELECT 1 as test')
            .then(result => {
              clearTimeout(timeout);
              resolve(result);
            })
            .catch(err => {
              clearTimeout(timeout);
              reject(err);
            });
        });
        
        await connectionTest;
        console.log('✅ PostgreSQL connection verified');
        
        // If we get here, connection is good, proceed with table creation
      // Users table
      await db.query(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Jobs table
      await db.query(`CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        customer_name VARCHAR(255) NOT NULL,
        vehicle_info TEXT,
        status VARCHAR(50) DEFAULT 'todo',
        assigned_to INTEGER,
        created_by INTEGER NOT NULL,
        estimated_hours DECIMAL(10,2),
        actual_hours DECIMAL(10,2) DEFAULT 0,
        photo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES users (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      )`);

      // Time tracking table
      await db.query(`CREATE TABLE IF NOT EXISTS time_logs (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration_minutes INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      // Calendar events table
      await db.query(`CREATE TABLE IF NOT EXISTS calendar_events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        event_time TIME,
        type VARCHAR(50) DEFAULT 'event',
        priority VARCHAR(50) DEFAULT 'medium',
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )`);

      // Employees table
      await db.query(`CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE,
        employee_code VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        position VARCHAR(255) NOT NULL,
        department VARCHAR(255),
        hire_date DATE NOT NULL,
        hourly_rate DECIMAL(10,2) DEFAULT 0,
        phone VARCHAR(50),
        address TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      // Customers table
      await db.query(`CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        company VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Spare parts table for PostgreSQL
      await db.query(`CREATE TABLE IF NOT EXISTS spare_parts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) UNIQUE,
        description TEXT,
        price DECIMAL(10,2),
        quantity_in_stock INTEGER DEFAULT 0,
        supplier VARCHAR(255),
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Quotes table for PostgreSQL
      await db.query(`CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        quote_number VARCHAR(50) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        customer_phone VARCHAR(50),
        vehicle_info TEXT,
        description TEXT,
        total_amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        valid_until DATE,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Quote items table for PostgreSQL
      await db.query(`CREATE TABLE IF NOT EXISTS quote_items (
        id SERIAL PRIMARY KEY,
        quote_id INTEGER REFERENCES quotes(id) ON DELETE CASCADE,
        item_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        spare_part_id INTEGER REFERENCES spare_parts(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Invoices table for PostgreSQL
      await db.query(`CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        customer_phone VARCHAR(50),
        customer_address TEXT,
        vehicle_info TEXT,
        description TEXT,
        subtotal DECIMAL(10,2) DEFAULT 0,
        tax_rate DECIMAL(5,2) DEFAULT 22.00,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        due_date DATE,
        paid_date DATE,
        quote_id INTEGER REFERENCES quotes(id),
        job_id INTEGER REFERENCES jobs(id),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Invoice items table for PostgreSQL
      await db.query(`CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        item_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        spare_part_id INTEGER REFERENCES spare_parts(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Job assignments table for PostgreSQL
      await db.query(`CREATE TABLE IF NOT EXISTS job_assignments (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        employee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by INTEGER REFERENCES users(id),
        UNIQUE(job_id, employee_id)
      )`);

      // Archived jobs table for PostgreSQL
      await db.query(`CREATE TABLE IF NOT EXISTS archived_jobs (
        id SERIAL PRIMARY KEY,
        original_job_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'completed',
        priority VARCHAR(50) DEFAULT 'medium',
        estimated_hours DECIMAL(5,2),
        actual_hours DECIMAL(5,2) DEFAULT 0,
        created_by INTEGER,
        created_by_name VARCHAR(255),
        created_at TIMESTAMP,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_date DATE,
        notes TEXT,
        assigned_employees TEXT
      )`);

      console.log('✅ PostgreSQL tables initialized');
      break; // Exit retry loop on success
      
    } catch (error) {
      retryCount++;
      console.error(`❌ Error initializing PostgreSQL tables (attempt ${retryCount}/${maxRetries}):`, error.message);
      
      if (retryCount >= maxRetries) {
        console.error('❌ Failed to initialize PostgreSQL tables after all retry attempts');
        throw error;
      }
      
      // Enhanced wait before retrying with longer delays for Render's database wake-up
      const baseWaitTime = Math.pow(2, retryCount) * 2000; // 4s, 8s, 16s, 32s, 64s
      const jitter = Math.random() * 1000; // Add up to 1s random jitter
      const waitTime = baseWaitTime + jitter;
      
      console.log(`⏳ Waiting ${Math.round(waitTime/1000)}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  } // End of retry while loop
  } else {
    // SQLite table creation (existing code)
    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Jobs table
      db.run(`CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        customer_name TEXT NOT NULL,
        vehicle_info TEXT,
        status TEXT DEFAULT 'todo',
        assigned_to INTEGER,
        created_by INTEGER NOT NULL,
        estimated_hours REAL,
        actual_hours REAL DEFAULT 0,
        photo_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES users (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      )`);

      // Time tracking table
      db.run(`CREATE TABLE IF NOT EXISTS time_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration_minutes INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      // Calendar events table
      db.run(`CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        event_time TIME,
        type TEXT DEFAULT 'event',
        priority TEXT DEFAULT 'medium',
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )`);

      // Employees table for detailed employee management
      db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      // Customers table
      db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        company TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      console.log('✅ SQLite tables initialized');
    });
  }
}

// Call initialization
initializeTables();

// Create default users for SQLite
if (!isPostgres) {
  // Create default admin user
  const adminEmail = 'admin@motta.it';
  const adminPassword = bcrypt.hashSync('admin123', 10);
  
  db.get("SELECT id FROM users WHERE email = ?", [adminEmail], (err, row) => {
    if (!row) {
      db.run("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)", 
        [adminEmail, adminPassword, 'Amministratore Motta', 'admin']);
      console.log('✅ Admin user created: admin@motta.it / admin123');
    }
  });

  // Create sample employee
  const employeeEmail = 'dipendente@motta.it';
  const employeePassword = bcrypt.hashSync('dipendente123', 10);
  
  db.get("SELECT id FROM users WHERE email = ?", [employeeEmail], (err, row) => {
    if (!row) {
      db.run("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)", 
        [employeeEmail, employeePassword, 'Mario Rossi', 'employee']);
      console.log('✅ Employee user created: dipendente@motta.it / dipendente123');
    }
  });
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token di accesso richiesto' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token non valido' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Ping endpoint per mantenere il servizio attivo su Render
app.get('/ping', (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`🏓 Ping ricevuto alle ${timestamp}`);
  res.status(200).json({ 
    status: 'alive', 
    timestamp: timestamp,
    message: 'Server is running' 
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  dbGet("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  });
});

// Get all users (for admin)
app.get('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  db.all("SELECT id, email, name, role, created_at FROM users", (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    res.json(users);
  });
});

// Get jobs
app.get('/api/jobs', authenticateToken, (req, res) => {
  let query = `
    SELECT j.*, 
           c.name as created_by_name
    FROM jobs j
    LEFT JOIN users c ON j.created_by = c.id
    ORDER BY j.created_at DESC
  `;
  
  // Tutti gli utenti (admin e dipendenti) possono vedere tutti i lavori
  db.all(query, [], (err, jobs) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }

    // Get assignments for all jobs
    const jobIds = jobs.map(job => job.id);
    if (jobIds.length === 0) {
      return res.json([]);
    }

    const placeholders = jobIds.map(() => '?').join(',');
    db.all(`
      SELECT ja.job_id, u.id, u.name, ja.assigned_at
      FROM job_assignments ja
      JOIN users u ON ja.user_id = u.id
      WHERE ja.job_id IN (${placeholders})
      ORDER BY ja.assigned_at
    `, jobIds, (err, assignments) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      // Group assignments by job_id
      const assignmentsByJob = {};
      assignments.forEach(assignment => {
        if (!assignmentsByJob[assignment.job_id]) {
          assignmentsByJob[assignment.job_id] = [];
        }
        assignmentsByJob[assignment.job_id].push({
          id: assignment.id,
          name: assignment.name,
          assigned_at: assignment.assigned_at
        });
      });

      // Add assigned employees to each job
      const jobsWithAssignments = jobs.map(job => {
        const jobAssignments = assignmentsByJob[job.id] || [];
        return {
          ...job,
          assigned_employees: jobAssignments,
          // For backward compatibility
          assigned_to: jobAssignments.length > 0 ? jobAssignments[0].id : null,
          assigned_to_name: jobAssignments.length > 0 ? jobAssignments[0].name : null
        };
      });

      res.json(jobsWithAssignments);
    });
  });
});

// Create job (admin only)
app.post('/api/jobs', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { title, description, customer_name, vehicle_info, assigned_to, estimated_hours } = req.body;

  // Support both single assignment (backward compatibility) and multiple assignments
  const assignedEmployees = Array.isArray(assigned_to) ? assigned_to : (assigned_to ? [assigned_to] : []);

  db.run(
    `INSERT INTO jobs (title, description, customer_name, vehicle_info, created_by, estimated_hours)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, description, customer_name, vehicle_info, req.user.id, estimated_hours],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      const jobId = this.lastID;

      // Insert job assignments if any employees are assigned
      if (assignedEmployees.length > 0) {
        const assignmentPromises = assignedEmployees.map(userId => {
          return new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO job_assignments (job_id, user_id, assigned_by) VALUES (?, ?, ?)`,
              [jobId, userId, req.user.id],
              function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          });
        });

        Promise.all(assignmentPromises)
          .then(() => {
            // Get the created job with assigned employees
            getJobWithAssignments(jobId, (err, job) => {
              if (err) {
                return res.status(500).json({ error: 'Errore del database' });
              }

              // Emit to all connected clients
              io.emit('jobCreated', job);
              res.status(201).json(job);
            });
          })
          .catch(err => {
            console.error('Error creating job assignments:', err);
            res.status(500).json({ error: 'Errore nell\'assegnazione dipendenti' });
          });
      } else {
        // No assignments, just return the job
        getJobWithAssignments(jobId, (err, job) => {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }

          // Emit to all connected clients
          io.emit('jobCreated', job);
          res.status(201).json(job);
        });
      }
    }
  );
});

// Add a general job update endpoint (admin only)
app.put('/api/jobs/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const jobId = req.params.id;
  const { title, description, customer_name, vehicle_info, assigned_to, estimated_hours } = req.body;

  // Support both single assignment (backward compatibility) and multiple assignments
  const assignedEmployees = Array.isArray(assigned_to) ? assigned_to : (assigned_to ? [assigned_to] : []);

  // Update job basic info
  db.run(
    `UPDATE jobs SET title = ?, description = ?, customer_name = ?, vehicle_info = ?, estimated_hours = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [title, description, customer_name, vehicle_info, estimated_hours, jobId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Lavoro non trovato' });
      }

      // Remove existing assignments
      db.run('DELETE FROM job_assignments WHERE job_id = ?', [jobId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Errore nella rimozione assegnazioni' });
        }

        // Insert new assignments if any
        if (assignedEmployees.length > 0) {
          const assignmentPromises = assignedEmployees.map(userId => {
            return new Promise((resolve, reject) => {
              db.run(
                `INSERT INTO job_assignments (job_id, user_id, assigned_by) VALUES (?, ?, ?)`,
                [jobId, userId, req.user.id],
                function(err) {
                  if (err) reject(err);
                  else resolve(this.lastID);
                }
              );
            });
          });

          Promise.all(assignmentPromises)
            .then(() => {
              // Get the updated job with assigned employees
              getJobWithAssignments(jobId, (err, job) => {
                if (err) {
                  return res.status(500).json({ error: 'Errore del database' });
                }

                // Emit to all connected clients
                io.emit('jobUpdated', job);
                res.json(job);
              });
            })
            .catch(err => {
              console.error('Error updating job assignments:', err);
              res.status(500).json({ error: 'Errore nell\'aggiornamento assegnazioni' });
            });
        } else {
          // No assignments, just return the job
          getJobWithAssignments(jobId, (err, job) => {
            if (err) {
              return res.status(500).json({ error: 'Errore del database' });
            }

            // Emit to all connected clients
            io.emit('jobUpdated', job);
            res.json(job);
          });
        }
      });
    }
  );
});

// Update job status
app.put('/api/jobs/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  const jobId = req.params.id;

  // Check if user can update this job
  let checkQuery = 'SELECT * FROM jobs WHERE id = ?';
  let checkParams = [jobId];

  if (req.user.role === 'employee') {
    checkQuery += ' AND assigned_to = ?';
    checkParams.push(req.user.id);
  }

  db.get(checkQuery, checkParams, (err, job) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }

    if (!job) {
      return res.status(404).json({ error: 'Lavoro non trovato o non autorizzato' });
    }

    db.run(
      'UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, jobId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Errore del database' });
        }

        // Get updated job with user names
        db.get(`
          SELECT j.*, 
                 u.name as assigned_to_name,
                 c.name as created_by_name
          FROM jobs j
          LEFT JOIN users u ON j.assigned_to = u.id
          LEFT JOIN users c ON j.created_by = c.id
          WHERE j.id = ?
        `, [jobId], (err, updatedJob) => {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }

          // If job is completed, archive it
          if (status === 'completed') {
            // Get total time spent on this job
            db.get(`
              SELECT SUM(duration_minutes) as total_minutes
              FROM time_logs 
              WHERE job_id = ? AND end_time IS NOT NULL
            `, [jobId], (err, timeResult) => {
              const totalMinutes = timeResult ? timeResult.total_minutes || 0 : 0;
              
              // Archive the completed job
              db.run(`
                INSERT INTO archived_jobs (
                  original_job_id, title, description, customer_name, vehicle_info,
                  assigned_to, assigned_to_name, created_by, created_by_name,
                  estimated_hours, actual_hours, created_at, updated_at,
                  total_time_minutes, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                updatedJob.id, updatedJob.title, updatedJob.description,
                updatedJob.customer_name, updatedJob.vehicle_info,
                updatedJob.assigned_to, updatedJob.assigned_to_name,
                updatedJob.created_by, updatedJob.created_by_name,
                updatedJob.estimated_hours, updatedJob.actual_hours,
                updatedJob.created_at, updatedJob.updated_at,
                totalMinutes, 'Lavoro completato e archiviato automaticamente'
              ], (archiveErr) => {
                if (archiveErr) {
                  console.error('Errore nell\'archiviazione:', archiveErr);
                }
              });
            });
          }

          // Emit to all connected clients
          io.emit('jobUpdated', updatedJob);
          res.json(updatedJob);
        });
      }
    );
  });
});

// Delete job (admin only)
app.delete('/api/jobs/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const jobId = req.params.id;

  db.run('DELETE FROM jobs WHERE id = ?', [jobId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Lavoro non trovato' });
    }

    // Emit to all connected clients
    io.emit('jobDeleted', { id: jobId });
    res.json({ message: 'Lavoro eliminato con successo' });
  });
});

// ===== ARCHIVED JOBS ROUTES =====

// Get all archived jobs (admin only)
app.get('/api/archived-jobs', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  db.all(`
    SELECT * FROM archived_jobs 
    ORDER BY archived_at DESC
  `, (err, archivedJobs) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(archivedJobs);
  });
});

// Get archived job statistics
app.get('/api/archived-jobs/stats', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  db.all(`
    SELECT 
      COUNT(*) as total_archived,
      SUM(actual_hours) as total_hours,
      SUM(total_time_minutes) as total_minutes,
      AVG(actual_hours) as avg_hours_per_job,
      assigned_to_name,
      COUNT(*) as jobs_completed
    FROM archived_jobs 
    GROUP BY assigned_to_name
    ORDER BY jobs_completed DESC
  `, (err, stats) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Get overall stats
    db.get(`
      SELECT 
        COUNT(*) as total_archived,
        SUM(actual_hours) as total_hours,
        SUM(total_time_minutes) as total_minutes,
        AVG(actual_hours) as avg_hours_per_job
      FROM archived_jobs
    `, (err, overall) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.json({
        overall: overall || { total_archived: 0, total_hours: 0, total_minutes: 0, avg_hours_per_job: 0 },
        by_employee: stats || []
      });
    });
  });
});

// Archive a completed job manually
app.post('/api/jobs/:id/archive', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  // First check if job exists and is completed
  db.get(`
    SELECT j.*, 
           u.name as assigned_to_name,
           c.name as created_by_name
    FROM jobs j
    LEFT JOIN users u ON j.assigned_to = u.id
    LEFT JOIN users c ON j.created_by = c.id
    WHERE j.id = ?
  `, [jobId], (err, job) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    
    if (!job) {
      return res.status(404).json({ error: 'Lavoro non trovato' });
    }
    
    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Solo i lavori completati possono essere archiviati' });
    }

    // Get total time spent on this job
    db.get(`
      SELECT SUM(duration_minutes) as total_minutes
      FROM time_logs 
      WHERE job_id = ? AND end_time IS NOT NULL
    `, [jobId], (err, timeResult) => {
      const totalMinutes = timeResult ? timeResult.total_minutes || 0 : 0;
      
      // Archive the completed job
      db.run(`
        INSERT INTO archived_jobs (
          original_job_id, title, description, customer_name, vehicle_info,
          assigned_to, assigned_to_name, created_by, created_by_name,
          estimated_hours, actual_hours, created_at, updated_at,
          total_time_minutes, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        job.id, job.title, job.description,
        job.customer_name, job.vehicle_info,
        job.assigned_to, job.assigned_to_name,
        job.created_by, job.created_by_name,
        job.estimated_hours, job.actual_hours,
        job.created_at, job.updated_at,
        totalMinutes, 'Lavoro archiviato manualmente'
      ], function(archiveErr) {
        if (archiveErr) {
          return res.status(500).json({ error: 'Errore nell\'archiviazione' });
        }

        // Delete the job from the main jobs table
        db.run('DELETE FROM jobs WHERE id = ?', [jobId], (deleteErr) => {
          if (deleteErr) {
            return res.status(500).json({ error: 'Errore nella rimozione del lavoro' });
          }

          // Emit to all connected clients that job was archived
          io.emit('jobArchived', { jobId: parseInt(jobId) });
          
          res.json({ 
            message: 'Lavoro archiviato con successo',
            archivedJobId: this.lastID 
          });
        });
      });
    });
  });
});

// ===== CALENDAR EVENTS ROUTES =====

// Get all calendar events
app.get('/api/calendar-events', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  db.all(`
    SELECT ce.*, u.name as created_by_name 
    FROM calendar_events ce 
    LEFT JOIN users u ON ce.created_by = u.id 
    ORDER BY ce.event_date ASC, ce.event_time ASC
  `, (err, events) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(events);
  });
});

// Create new calendar event
app.post('/api/calendar-events', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { title, description, event_date, event_time, type, priority } = req.body;

  if (!title || !event_date) {
    return res.status(400).json({ error: 'Titolo e data sono obbligatori' });
  }

  db.run(`
    INSERT INTO calendar_events (title, description, event_date, event_time, type, priority, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [title, description, event_date, event_time, type || 'event', priority || 'medium', req.user.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Get the created event
    db.get(`
      SELECT ce.*, u.name as created_by_name 
      FROM calendar_events ce 
      LEFT JOIN users u ON ce.created_by = u.id 
      WHERE ce.id = ?
    `, [this.lastID], (err, event) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Emit real-time update
      io.emit('eventCreated', event);
      res.status(201).json(event);
    });
  });
});

// Update calendar event
app.put('/api/calendar-events/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { id } = req.params;
  const { title, description, event_date, event_time, type, priority } = req.body;

  db.run(`
    UPDATE calendar_events 
    SET title = ?, description = ?, event_date = ?, event_time = ?, type = ?, priority = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [title, description, event_date, event_time, type, priority, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    // Get the updated event
    db.get(`
      SELECT ce.*, u.name as created_by_name 
      FROM calendar_events ce 
      LEFT JOIN users u ON ce.created_by = u.id 
      WHERE ce.id = ?
    `, [id], (err, event) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Emit real-time update
      io.emit('eventUpdated', event);
      res.json(event);
    });
  });
});

// Delete calendar event
app.delete('/api/calendar-events/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { id } = req.params;

  db.run('DELETE FROM calendar_events WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Evento non trovato' });
    }

    // Emit real-time update
    io.emit('eventDeleted', { id: parseInt(id) });
    res.json({ message: 'Evento eliminato con successo' });
  });
});

// ===== TIMER ROUTES =====

// Start timer
app.post('/api/jobs/:id/timer/start', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  const userId = req.user.id;

  // Check if there's already an active timer for this specific job and user
  db.get(
    'SELECT * FROM time_logs WHERE user_id = ? AND job_id = ? AND end_time IS NULL',
    [userId, jobId],
    (err, activeTimer) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      if (activeTimer) {
        return res.status(400).json({ error: 'Hai già un timer attivo per questo lavoro' });
      }

      // Start new timer
      db.run(
        'INSERT INTO time_logs (job_id, user_id, start_time) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [jobId, userId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }

          // Update job status to 'in_progress' if it's 'todo'
          db.run(
            'UPDATE jobs SET status = CASE WHEN status = "todo" THEN "in_progress" ELSE status END WHERE id = ?',
            [jobId]
          );

          res.json({ id: this.lastID, message: 'Timer avviato' });
        }
      );
    }
  );
});

// Stop timer
app.post('/api/jobs/:id/timer/stop', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  const userId = req.user.id;

  db.get(
    'SELECT * FROM time_logs WHERE job_id = ? AND user_id = ? AND end_time IS NULL',
    [jobId, userId],
    (err, timer) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      if (!timer) {
        return res.status(404).json({ error: 'Timer attivo non trovato' });
      }

      db.run(
        `UPDATE time_logs 
         SET end_time = CURRENT_TIMESTAMP,
             duration_minutes = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(start_time)) * 1440)
         WHERE id = ?`,
        [timer.id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }

          // Update total actual hours for the job
          db.run(
            `UPDATE jobs 
             SET actual_hours = (
               SELECT ROUND(SUM(duration_minutes) / 60.0, 2)
               FROM time_logs 
               WHERE job_id = ? AND end_time IS NOT NULL
             )
             WHERE id = ?`,
            [jobId, jobId]
          );

          res.json({ message: 'Timer fermato' });
        }
      );
    }
  );
});

// Get active timer for user
app.get('/api/timer/active', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(
    `SELECT tl.*, j.title as job_title 
     FROM time_logs tl 
     JOIN jobs j ON tl.job_id = j.id 
     WHERE tl.user_id = ? AND tl.end_time IS NULL`,
    [userId],
    (err, activeTimers) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      res.json(activeTimers);
    }
  );
});

// Employee Management Endpoints

// Get all employees (admin only)
app.get('/api/employees', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const query = `
    SELECT e.*, u.email, u.name as user_name,
           COALESCE(SUM(tl.duration_minutes), 0) as total_minutes_worked
    FROM employees e
    LEFT JOIN users u ON e.user_id = u.id
    LEFT JOIN time_logs tl ON u.id = tl.user_id
    WHERE e.status = 'active'
    GROUP BY e.id
    ORDER BY e.last_name, e.first_name
  `;

  db.all(query, [], (err, employees) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    res.json(employees);
  });
});

// Get single employee (admin only)
app.get('/api/employees/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const query = `
    SELECT e.*, u.email, u.name as user_name,
           COALESCE(SUM(tl.duration_minutes), 0) as total_minutes_worked
    FROM employees e
    LEFT JOIN users u ON e.user_id = u.id
    LEFT JOIN time_logs tl ON u.id = tl.user_id
    WHERE e.id = ?
    GROUP BY e.id
  `;

  db.get(query, [req.params.id], (err, employee) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    if (!employee) {
      return res.status(404).json({ error: 'Dipendente non trovato' });
    }
    res.json(employee);
  });
});

// Create employee (admin only)
app.post('/api/employees', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const {
    employee_code,
    first_name,
    last_name,
    position,
    department,
    hire_date,
    hourly_rate,
    phone,
    address,
    user_id
  } = req.body;

  if (!employee_code || !first_name || !last_name || !position || !hire_date) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  }

  db.run(
    `INSERT INTO employees (employee_code, first_name, last_name, position, department, hire_date, hourly_rate, phone, address, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [employee_code, first_name, last_name, position, department, hire_date, hourly_rate || 0, phone, address, user_id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Codice dipendente già esistente' });
        }
        return res.status(500).json({ error: 'Errore del database' });
      }

      // Get the created employee
      db.get(
        `SELECT e.*, u.email, u.name as user_name
         FROM employees e
         LEFT JOIN users u ON e.user_id = u.id
         WHERE e.id = ?`,
        [this.lastID],
        (err, employee) => {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }
          res.status(201).json(employee);
        }
      );
    }
  );
});

// Update employee (admin only)
app.put('/api/employees/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const {
    employee_code,
    first_name,
    last_name,
    position,
    department,
    hire_date,
    hourly_rate,
    phone,
    address,
    status
  } = req.body;

  db.run(
    `UPDATE employees SET 
     employee_code = ?, first_name = ?, last_name = ?, position = ?, 
     department = ?, hire_date = ?, hourly_rate = ?, phone = ?, 
     address = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [employee_code, first_name, last_name, position, department, hire_date, hourly_rate, phone, address, status, req.params.id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Codice dipendente già esistente' });
        }
        return res.status(500).json({ error: 'Errore del database' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Dipendente non trovato' });
      }

      // Get the updated employee
      db.get(
        `SELECT e.*, u.email, u.name as user_name
         FROM employees e
         LEFT JOIN users u ON e.user_id = u.id
         WHERE e.id = ?`,
        [req.params.id],
        (err, employee) => {
          if (err) {
            return res.status(500).json({ error: 'Errore del database' });
          }
          res.json(employee);
        }
      );
    }
  );
});

// Delete employee (admin only)
app.delete('/api/employees/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  db.run(
    'UPDATE employees SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Dipendente non trovato' });
      }

      res.json({ message: 'Dipendente disattivato con successo' });
    }
  );
});

// Get employee work hours summary (admin only)
app.get('/api/employees/:id/hours', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const { startDate, endDate } = req.query;
  let query = `
    SELECT 
      DATE(tl.start_time) as work_date,
      SUM(tl.duration_minutes) as total_minutes,
      COUNT(tl.id) as sessions_count,
      GROUP_CONCAT(j.title) as jobs_worked
    FROM time_logs tl
    JOIN jobs j ON tl.job_id = j.id
    JOIN employees e ON e.user_id = tl.user_id
    WHERE e.id = ? AND tl.end_time IS NOT NULL
  `;
  
  let params = [req.params.id];

  if (startDate) {
    query += ' AND DATE(tl.start_time) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND DATE(tl.start_time) <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY DATE(tl.start_time) ORDER BY work_date DESC';

  db.all(query, params, (err, hours) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    res.json(hours);
  });
});

// Customer routes

// Get all customers
app.get('/api/customers', authenticateToken, (req, res) => {
  db.all("SELECT * FROM customers ORDER BY name ASC", (err, customers) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    res.json(customers);
  });
});

// Get customer by ID
app.get('/api/customers/:id', authenticateToken, (req, res) => {
  const customerId = req.params.id;
  
  db.get("SELECT * FROM customers WHERE id = ?", [customerId], (err, customer) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }
    
    if (!customer) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }
    
    res.json(customer);
  });
});

// Create new customer
app.post('/api/customers', authenticateToken, (req, res) => {
  const { name, email, phone, address, company, notes } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Il nome del cliente è obbligatorio' });
  }
  
  const query = `
    INSERT INTO customers (name, email, phone, address, company, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [name, email, phone, address, company, notes], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Errore durante la creazione del cliente' });
    }
    
    // Get the created customer
    db.get("SELECT * FROM customers WHERE id = ?", [this.lastID], (err, customer) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      io.emit('customerCreated', customer);
      res.status(201).json(customer);
    });
  });
});

// Update customer
app.put('/api/customers/:id', authenticateToken, (req, res) => {
  const customerId = req.params.id;
  const { name, email, phone, address, company, notes } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Il nome del cliente è obbligatorio' });
  }
  
  const query = `
    UPDATE customers 
    SET name = ?, email = ?, phone = ?, address = ?, company = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [name, email, phone, address, company, notes, customerId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Errore durante l\'aggiornamento del cliente' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }
    
    // Get the updated customer
    db.get("SELECT * FROM customers WHERE id = ?", [customerId], (err, customer) => {
      if (err) {
        return res.status(500).json({ error: 'Errore del database' });
      }
      
      io.emit('customerUpdated', customer);
      res.json(customer);
    });
  });
});

// Delete customer
app.delete('/api/customers/:id', authenticateToken, (req, res) => {
  const customerId = req.params.id;
  
  db.run("DELETE FROM customers WHERE id = ?", [customerId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Errore durante l\'eliminazione del cliente' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }
    
    io.emit('customerDeleted', { id: parseInt(customerId) });
    res.json({ message: 'Cliente eliminato con successo' });
  });
});

// Upload photo for a job (employees can upload photos for jobs they're assigned to)
app.post('/api/jobs/:id/photo', authenticateToken, upload.single('photo'), (req, res) => {
  const jobId = req.params.id;
  
  if (!req.file) {
    return res.status(400).json({ error: 'Nessun file caricato' });
  }

  // Check if user is assigned to this job or is admin
  const checkAssignmentQuery = `
    SELECT j.*, ja.user_id 
    FROM jobs j
    LEFT JOIN job_assignments ja ON j.id = ja.job_id
    WHERE j.id = ? AND (ja.user_id = ? OR ? = 'admin')
  `;

  db.get(checkAssignmentQuery, [jobId, req.user.id, req.user.role], (err, job) => {
    if (err) {
      return res.status(500).json({ error: 'Errore del database' });
    }

    if (!job && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Non sei autorizzato a caricare foto per questo lavoro' });
    }

    // Generate the photo URL
    const photoUrl = `/uploads/${req.file.filename}`;

    // Update job with photo URL
    db.run(
      'UPDATE jobs SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [photoUrl, jobId],
      function(err) {
        if (err) {
          // Delete the uploaded file if database update fails
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: 'Errore nell\'aggiornamento del database' });
        }

        if (this.changes === 0) {
          // Delete the uploaded file if job not found
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: 'Lavoro non trovato' });
        }

        // Get updated job with assignments
        getJobWithAssignments(jobId, (err, updatedJob) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero del lavoro aggiornato' });
          }

          // Emit to all connected clients
          io.emit('jobUpdated', updatedJob);
          
          res.json({
            message: 'Foto caricata con successo',
            photo_url: photoUrl,
            job: updatedJob
          });
        });
      }
    );
  });
});

// ==================== SPARE PARTS ENDPOINTS ====================

// Get spare parts for a job
app.get('/api/jobs/:id/spare-parts', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  
  dbAll(
    'SELECT * FROM spare_parts WHERE job_id = ? ORDER BY created_at DESC',
    [jobId],
    (err, spareParts) => {
      if (err) {
        return res.status(500).json({ error: 'Errore nel recupero dei pezzi di ricambio' });
      }
      res.json(spareParts);
    }
  );
});

// Add spare part to a job
app.post('/api/jobs/:id/spare-parts', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  const { name, part_number, supplier, quantity, unit_price } = req.body;
  
  if (!name || !quantity || !unit_price) {
    return res.status(400).json({ error: 'Nome, quantità e prezzo unitario sono obbligatori' });
  }
  
  const total_price = quantity * unit_price;
  
  dbRun(
    `INSERT INTO spare_parts (job_id, name, part_number, supplier, quantity, unit_price, total_price)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [jobId, name, part_number, supplier, quantity, unit_price, total_price],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore nell\'aggiunta del pezzo di ricambio' });
      }
      
      // Get the created spare part
      dbGet(
        'SELECT * FROM spare_parts WHERE id = ?',
        [this.lastID],
        (err, sparePart) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero del pezzo creato' });
          }
          
          // Emit to all connected clients
          io.emit('sparePartAdded', { jobId, sparePart });
          
          res.status(201).json(sparePart);
        }
      );
    }
  );
});

// Update spare part
app.put('/api/spare-parts/:id', authenticateToken, (req, res) => {
  const sparePartId = req.params.id;
  const { name, part_number, supplier, quantity, unit_price } = req.body;
  
  if (!name || !quantity || !unit_price) {
    return res.status(400).json({ error: 'Nome, quantità e prezzo unitario sono obbligatori' });
  }
  
  const total_price = quantity * unit_price;
  
  dbRun(
    `UPDATE spare_parts 
     SET name = ?, part_number = ?, supplier = ?, quantity = ?, unit_price = ?, total_price = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, part_number, supplier, quantity, unit_price, total_price, sparePartId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore nell\'aggiornamento del pezzo di ricambio' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Pezzo di ricambio non trovato' });
      }
      
      // Get the updated spare part
      dbGet(
        'SELECT * FROM spare_parts WHERE id = ?',
        [sparePartId],
        (err, sparePart) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero del pezzo aggiornato' });
          }
          
          // Emit to all connected clients
          io.emit('sparePartUpdated', sparePart);
          
          res.json(sparePart);
        }
      );
    }
  );
});

// Delete spare part
app.delete('/api/spare-parts/:id', authenticateToken, (req, res) => {
  const sparePartId = req.params.id;
  
  // Get spare part info before deletion for socket emission
  dbGet(
    'SELECT job_id FROM spare_parts WHERE id = ?',
    [sparePartId],
    (err, sparePart) => {
      if (err) {
        return res.status(500).json({ error: 'Errore nel recupero del pezzo di ricambio' });
      }
      
      if (!sparePart) {
        return res.status(404).json({ error: 'Pezzo di ricambio non trovato' });
      }
      
      dbRun(
        'DELETE FROM spare_parts WHERE id = ?',
        [sparePartId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Errore nella cancellazione del pezzo di ricambio' });
          }
          
          // Emit to all connected clients
          io.emit('sparePartDeleted', { jobId: sparePart.job_id, sparePartId });
          
          res.json({ message: 'Pezzo di ricambio cancellato con successo' });
        }
      );
    }
  );
});

// ==================== QUOTES ENDPOINTS ====================

// Get quote for a job
app.get('/api/jobs/:id/quote', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  
  dbGet(
    'SELECT * FROM quotes WHERE job_id = ? ORDER BY created_at DESC LIMIT 1',
    [jobId],
    (err, quote) => {
      if (err) {
        return res.status(500).json({ error: 'Errore nel recupero del preventivo' });
      }
      
      if (!quote) {
        return res.status(404).json({ error: 'Preventivo non trovato' });
      }
      
      // Get quote items
      dbAll(
        'SELECT * FROM quote_items WHERE quote_id = ? ORDER BY created_at',
        [quote.id],
        (err, items) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero degli elementi del preventivo' });
          }
          
          res.json({ ...quote, items });
        }
      );
    }
  );
});

// Create or update quote for a job
app.post('/api/jobs/:id/quote', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  const { 
    labor_hours, 
    labor_rate, 
    parts_total, 
    tax_rate, 
    notes 
  } = req.body;
  
  const labor_total = (labor_hours || 0) * (labor_rate || 0);
  const subtotal = labor_total + (parts_total || 0);
  const tax_amount = subtotal * (tax_rate || 0.22);
  const total_amount = subtotal + tax_amount;
  
  // Generate quote number
  const quote_number = `Q-${Date.now()}-${jobId}`;
  
  // Check if quote already exists
  dbGet(
    'SELECT id FROM quotes WHERE job_id = ?',
    [jobId],
    (err, existingQuote) => {
      if (err) {
        return res.status(500).json({ error: 'Errore nella verifica del preventivo esistente' });
      }
      
      if (existingQuote) {
        // Update existing quote
        dbRun(
          `UPDATE quotes 
           SET labor_hours = ?, labor_rate = ?, labor_total = ?, parts_total = ?, 
               subtotal = ?, tax_rate = ?, tax_amount = ?, total_amount = ?, 
               notes = ?, updated_at = CURRENT_TIMESTAMP
           WHERE job_id = ?`,
          [labor_hours, labor_rate, labor_total, parts_total, subtotal, 
           tax_rate, tax_amount, total_amount, notes, jobId],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Errore nell\'aggiornamento del preventivo' });
            }
            
            // Get updated quote
            dbGet(
              'SELECT * FROM quotes WHERE job_id = ?',
              [jobId],
              (err, quote) => {
                if (err) {
                  return res.status(500).json({ error: 'Errore nel recupero del preventivo aggiornato' });
                }
                
                // Emit to all connected clients
                io.emit('quoteUpdated', { jobId, quote });
                
                res.json(quote);
              }
            );
          }
        );
      } else {
        // Create new quote
        dbRun(
          `INSERT INTO quotes (job_id, quote_number, labor_hours, labor_rate, labor_total, 
                              parts_total, subtotal, tax_rate, tax_amount, total_amount, 
                              notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [jobId, quote_number, labor_hours, labor_rate, labor_total, parts_total, 
           subtotal, tax_rate, tax_amount, total_amount, notes, req.user.id],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Errore nella creazione del preventivo' });
            }
            
            // Get created quote
            dbGet(
              'SELECT * FROM quotes WHERE id = ?',
              [this.lastID],
              (err, quote) => {
                if (err) {
                  return res.status(500).json({ error: 'Errore nel recupero del preventivo creato' });
                }
                
                // Emit to all connected clients
                io.emit('quoteCreated', { jobId, quote });
                
                res.status(201).json(quote);
              }
            );
          }
        );
      }
    }
  );
});

// Update quote status
app.put('/api/quotes/:id/status', authenticateToken, (req, res) => {
  const quoteId = req.params.id;
  const { status } = req.body;
  
  if (!['draft', 'sent', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status non valido' });
  }
  
  let updateFields = 'status = ?, updated_at = CURRENT_TIMESTAMP';
  let params = [status];
  
  // Set timestamp fields based on status
  if (status === 'sent') {
    updateFields += ', sent_at = CURRENT_TIMESTAMP';
  } else if (status === 'approved') {
    updateFields += ', approved_at = CURRENT_TIMESTAMP';
  } else if (status === 'rejected') {
    updateFields += ', rejected_at = CURRENT_TIMESTAMP';
  }
  
  params.push(quoteId);
  
  dbRun(
    `UPDATE quotes SET ${updateFields} WHERE id = ?`,
    params,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore nell\'aggiornamento dello status del preventivo' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Preventivo non trovato' });
      }
      
      // Get updated quote
      dbGet(
        'SELECT * FROM quotes WHERE id = ?',
        [quoteId],
        (err, quote) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero del preventivo aggiornato' });
          }
          
          // Emit to all connected clients
          io.emit('quoteStatusUpdated', quote);
          
          res.json(quote);
        }
      );
    }
  );
});

// Create a new quote
app.post('/api/quotes', authenticateToken, (req, res) => {
  const {
    job_id,
    labor_hours,
    labor_rate,
    tax_rate,
    notes
  } = req.body;

  // Validate required fields
  if (!job_id) {
    return res.status(400).json({ error: 'Job ID è obbligatorio' });
  }

  // Get spare parts for this job to calculate parts total
  dbAll(
    'SELECT * FROM spare_parts WHERE job_id = ?',
    [job_id],
    (err, spareParts) => {
      if (err) {
        console.error('Errore nel recupero dei pezzi di ricambio:', err);
        return res.status(500).json({ error: 'Errore nel recupero dei pezzi di ricambio' });
      }

      // Calculate totals
      const labor_total = (labor_hours || 0) * (labor_rate || 35);
      const parts_total = spareParts.reduce((sum, part) => sum + (part.total_price || 0), 0);
      const subtotal = labor_total + parts_total;
      const tax_rate_decimal = (tax_rate || 22) / 100;
      const tax_amount = subtotal * tax_rate_decimal;
      const total_amount = subtotal + tax_amount;

      // Generate quote number
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
      const quote_number = `PREV-${year}${month}${day}-${time}`;

      const query = `
        INSERT INTO quotes (
          job_id, quote_number, labor_hours, labor_rate, labor_total,
          parts_total, subtotal, tax_rate, tax_amount, total_amount,
          notes, status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      const params = [
        job_id,
        quote_number,
        labor_hours || 0,
        labor_rate || 35,
        labor_total,
        parts_total,
        subtotal,
        tax_rate || 22,
        tax_amount,
        total_amount,
        notes || null,
        req.user.id
      ];

      dbRun(query, params, function(err) {
        if (err) {
          console.error('Errore nella creazione del preventivo:', err);
          return res.status(500).json({ error: 'Errore nella creazione del preventivo' });
        }

        // Get the created quote
        dbGet(
          'SELECT * FROM quotes WHERE id = ?',
          [this.lastID],
          (err, quote) => {
            if (err) {
              console.error('Errore nel recupero del preventivo creato:', err);
              return res.status(500).json({ error: 'Errore nel recupero del preventivo creato' });
            }

            // Emit to all connected clients
            io.emit('quoteCreated', quote);

            res.status(201).json(quote);
          }
        );
      });
    }
  );
});

// Get all quotes (admin only)
app.get('/api/quotes', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }
  
  const { status, limit = 50, offset = 0 } = req.query;
  
  let query = `
    SELECT q.*, j.title as job_title, j.customer_name, u.name as created_by_name
    FROM quotes q
    JOIN jobs j ON q.job_id = j.id
    JOIN users u ON q.created_by = u.id
  `;
  let params = [];
  
  if (status) {
    query += ' WHERE q.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY q.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  dbAll(query, params, (err, quotes) => {
    if (err) {
      return res.status(500).json({ error: 'Errore nel recupero dei preventivi' });
    }
    
    res.json(quotes);
  });
});

// Invoice routes

// Get all invoices (admin only)
app.get('/api/invoices', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso negato' });
  }
  
  const { status, limit = 50, offset = 0 } = req.query;
  
  let query = `
    SELECT i.*, j.title as job_title, j.customer_name, u.name as created_by_name,
           q.quote_number
    FROM invoices i
    JOIN jobs j ON i.job_id = j.id
    JOIN users u ON i.created_by = u.id
    LEFT JOIN quotes q ON i.quote_id = q.id
  `;
  let params = [];
  
  if (status) {
    query += ' WHERE i.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  dbAll(query, params, (err, invoices) => {
    if (err) {
      return res.status(500).json({ error: 'Errore nel recupero delle fatture' });
    }
    
    res.json(invoices);
  });
});

// Get invoice by ID
app.get('/api/invoices/:id', authenticateToken, (req, res) => {
  const invoiceId = req.params.id;
  
  dbGet(
    `SELECT i.*, j.title as job_title, j.customer_name, u.name as created_by_name,
            q.quote_number
     FROM invoices i
     JOIN jobs j ON i.job_id = j.id
     JOIN users u ON i.created_by = u.id
     LEFT JOIN quotes q ON i.quote_id = q.id
     WHERE i.id = ?`,
    [invoiceId],
    (err, invoice) => {
      if (err) {
        return res.status(500).json({ error: 'Errore nel recupero della fattura' });
      }
      
      if (!invoice) {
        return res.status(404).json({ error: 'Fattura non trovata' });
      }
      
      res.json(invoice);
    }
  );
});

// Create new invoice
app.post('/api/invoices', authenticateToken, (req, res) => {
  const { 
    quote_id,
    job_id,
    invoice_number,
    invoice_date,
    due_date,
    labor_hours, 
    labor_rate, 
    parts_total, 
    tax_rate, 
    notes,
    payment_method,
    status = 'draft'
  } = req.body;
  
  if (!job_id) {
    return res.status(400).json({ error: 'Job ID è richiesto' });
  }
  
  if (!invoice_number) {
    return res.status(400).json({ error: 'Numero fattura è richiesto' });
  }
  
  if (!invoice_date) {
    return res.status(400).json({ error: 'Data fattura è richiesta' });
  }
  
  if (!due_date) {
    return res.status(400).json({ error: 'Data scadenza è richiesta' });
  }
  
  const labor_total = (labor_hours || 0) * (labor_rate || 0);
  const subtotal = labor_total + (parts_total || 0);
  const tax_amount = subtotal * (tax_rate || 0.22);
  const total_amount = subtotal + tax_amount;
  
  dbRun(
    `INSERT INTO invoices (quote_id, job_id, invoice_number, invoice_date, due_date,
                          labor_hours, labor_rate, labor_total, parts_total, subtotal, 
                          tax_rate, tax_amount, total_amount, notes, payment_method, 
                          status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [quote_id, job_id, invoice_number, invoice_date, due_date, labor_hours, 
     labor_rate, labor_total, parts_total, subtotal, tax_rate, tax_amount, 
     total_amount, notes, payment_method, status, req.user.id],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ error: 'Numero fattura già esistente' });
        }
        return res.status(500).json({ error: 'Errore nella creazione della fattura' });
      }
      
      // Get created invoice
      dbGet(
        `SELECT i.*, j.title as job_title, j.customer_name, u.name as created_by_name,
                q.quote_number
         FROM invoices i
         JOIN jobs j ON i.job_id = j.id
         JOIN users u ON i.created_by = u.id
         LEFT JOIN quotes q ON i.quote_id = q.id
         WHERE i.id = ?`,
        [this.lastID],
        (err, invoice) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero della fattura creata' });
          }
          
          // Emit to all connected clients
          io.emit('invoiceCreated', invoice);
          
          res.status(201).json(invoice);
        }
      );
    }
  );
});

// Update invoice
app.put('/api/invoices/:id', authenticateToken, (req, res) => {
  const invoiceId = req.params.id;
  const { 
    quote_id,
    job_id,
    invoice_number,
    invoice_date,
    due_date,
    labor_hours, 
    labor_rate, 
    parts_total, 
    tax_rate, 
    notes,
    payment_method,
    status
  } = req.body;
  
  const labor_total = (labor_hours || 0) * (labor_rate || 0);
  const subtotal = labor_total + (parts_total || 0);
  const tax_amount = subtotal * (tax_rate || 0.22);
  const total_amount = subtotal + tax_amount;
  
  dbRun(
    `UPDATE invoices 
     SET quote_id = ?, job_id = ?, invoice_number = ?, invoice_date = ?, due_date = ?,
         labor_hours = ?, labor_rate = ?, labor_total = ?, parts_total = ?, 
         subtotal = ?, tax_rate = ?, tax_amount = ?, total_amount = ?, 
         notes = ?, payment_method = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [quote_id, job_id, invoice_number, invoice_date, due_date, labor_hours, 
     labor_rate, labor_total, parts_total, subtotal, tax_rate, tax_amount, 
     total_amount, notes, payment_method, status, invoiceId],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ error: 'Numero fattura già esistente' });
        }
        return res.status(500).json({ error: 'Errore nell\'aggiornamento della fattura' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Fattura non trovata' });
      }
      
      // Get updated invoice
      dbGet(
        `SELECT i.*, j.title as job_title, j.customer_name, u.name as created_by_name,
                q.quote_number
         FROM invoices i
         JOIN jobs j ON i.job_id = j.id
         JOIN users u ON i.created_by = u.id
         LEFT JOIN quotes q ON i.quote_id = q.id
         WHERE i.id = ?`,
        [invoiceId],
        (err, invoice) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero della fattura aggiornata' });
          }
          
          // Emit to all connected clients
          io.emit('invoiceUpdated', invoice);
          
          res.json(invoice);
        }
      );
    }
  );
});

// Update invoice status
app.put('/api/invoices/:id/status', authenticateToken, (req, res) => {
  const invoiceId = req.params.id;
  const { status } = req.body;
  
  if (!['draft', 'sent', 'paid', 'overdue'].includes(status)) {
    return res.status(400).json({ error: 'Status non valido' });
  }
  
  let updateFields = 'status = ?, updated_at = CURRENT_TIMESTAMP';
  let params = [status];
  
  // Set timestamp fields based on status
  if (status === 'sent') {
    updateFields += ', sent_at = CURRENT_TIMESTAMP';
  } else if (status === 'paid') {
    updateFields += ', paid_at = CURRENT_TIMESTAMP';
  }
  
  params.push(invoiceId);
  
  dbRun(
    `UPDATE invoices SET ${updateFields} WHERE id = ?`,
    params,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore nell\'aggiornamento dello status della fattura' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Fattura non trovata' });
      }
      
      // Get updated invoice
      dbGet(
        `SELECT i.*, j.title as job_title, j.customer_name, u.name as created_by_name,
                q.quote_number
         FROM invoices i
         JOIN jobs j ON i.job_id = j.id
         JOIN users u ON i.created_by = u.id
         LEFT JOIN quotes q ON i.quote_id = q.id
         WHERE i.id = ?`,
        [invoiceId],
        (err, invoice) => {
          if (err) {
            return res.status(500).json({ error: 'Errore nel recupero della fattura aggiornata' });
          }
          
          // Emit to all connected clients
          io.emit('invoiceStatusUpdated', invoice);
          
          res.json(invoice);
        }
      );
    }
  );
});

// Delete invoice
app.delete('/api/invoices/:id', authenticateToken, (req, res) => {
  const invoiceId = req.params.id;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo gli amministratori possono eliminare le fatture' });
  }
  
  dbRun(
    'DELETE FROM invoices WHERE id = ?',
    [invoiceId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore nell\'eliminazione della fattura' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Fattura non trovata' });
      }
      
      // Emit to all connected clients
      io.emit('invoiceDeleted', { id: invoiceId });
      
      res.json({ message: 'Fattura eliminata con successo' });
    }
  );
});

// Catch-all handler: send back React's index.html file for any non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const isRender = process.env.RENDER === 'true';
    const indexPath = isRender 
      ? path.join(__dirname, '..', 'client', 'build', 'index.html')  // Su Render
      : path.join(__dirname, '..', 'client', 'build', 'index.html'); // In locale
    
    console.log('🔍 Index path:', indexPath);
    console.log('🔍 Is Render:', isRender);
    res.sendFile(indexPath);
  });
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connesso:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnesso:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server avviato su porta ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:3000`);
  console.log(`🔧 API: http://localhost:${PORT}/api`);
  
  // Inizializza sistema backup automatico solo per SQLite
  if (!isPostgres) {
    try {
      const backupSystem = new DatabaseBackupSystem();
      backupSystem.startAutomaticBackup();
      console.log('💾 Sistema backup automatico inizializzato');
    } catch (error) {
      console.error('❌ Errore inizializzazione backup:', error.message);
    }
  }
  
  // Sistema di auto-ping per mantenere il servizio attivo su Render
  if (process.env.NODE_ENV === 'production' && process.env.RENDER === 'true') {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `https://motta-carrozzeria.onrender.com`;
    const PING_INTERVAL = 12 * 60 * 1000; // 12 minuti in millisecondi
    
    console.log(`🏓 Sistema auto-ping attivato per ${RENDER_URL}`);
    console.log(`⏰ Intervallo ping: ${PING_INTERVAL / 1000 / 60} minuti`);
    
    // Primo ping dopo 2 minuti dall'avvio
    setTimeout(() => {
      startAutoPing(RENDER_URL, PING_INTERVAL);
    }, 2 * 60 * 1000);
  }
});

// Funzione per il sistema di auto-ping
function startAutoPing(url, interval) {
  const https = require('https');
  const http = require('http');
  
  function ping() {
    const pingUrl = `${url}/ping`;
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(pingUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`🏓 Auto-ping riuscito: ${response.timestamp}`);
        } catch (e) {
          console.log(`🏓 Auto-ping riuscito (status: ${res.statusCode})`);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`❌ Auto-ping fallito:`, err.message);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      console.error(`⏰ Auto-ping timeout`);
    });
  }
  
  // Esegui ping immediatamente e poi ogni intervallo
  ping();
  setInterval(ping, interval);
}

module.exports = { app, server, db };