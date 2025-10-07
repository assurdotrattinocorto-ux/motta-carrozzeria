const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('Creating database tables...');

db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Error creating users table:', err);
    else console.log('✅ Users table created');
  });

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`, (err) => {
    if (err) console.error('Error creating jobs table:', err);
    else console.log('✅ Jobs table created');
  });

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
  )`, (err) => {
    if (err) console.error('Error creating time_logs table:', err);
    else console.log('✅ Time logs table created');
  });

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
  )`, (err) => {
    if (err) console.error('Error creating calendar_events table:', err);
    else console.log('✅ Calendar events table created');
  });

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
  )`, (err) => {
    if (err) console.error('Error creating employees table:', err);
    else console.log('✅ Employees table created');
  });

  // Customers table
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    company TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Error creating customers table:', err);
    else console.log('✅ Customers table created');
  });

  // Create default admin user (without bcrypt for now)
  const adminEmail = 'admin@motta.it';
  const adminPassword = 'admin123'; // Plain text for now
  
  db.get("SELECT id FROM users WHERE email = ?", [adminEmail], (err, row) => {
    if (!row) {
      db.run("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)", 
        [adminEmail, adminPassword, 'Amministratore Motta', 'admin'], (err) => {
          if (err) console.error('Error creating admin user:', err);
          else console.log('✅ Admin user created: admin@motta.it / admin123');
        });
    } else {
      console.log('✅ Admin user already exists');
    }
    
    // Close database after all operations
    setTimeout(() => {
      db.close((err) => {
        if (err) console.error('Error closing database:', err);
        else console.log('✅ Database setup complete');
      });
    }, 1000);
  });
});