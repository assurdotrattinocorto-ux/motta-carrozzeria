const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('Creating archived jobs table...');

db.serialize(() => {
  // Archived jobs table
  db.run(`CREATE TABLE IF NOT EXISTS archived_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_job_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    customer_name TEXT NOT NULL,
    vehicle_info TEXT,
    assigned_to INTEGER,
    assigned_to_name TEXT,
    created_by INTEGER NOT NULL,
    created_by_name TEXT,
    estimated_hours REAL,
    actual_hours REAL DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_time_minutes INTEGER DEFAULT 0,
    notes TEXT
  )`, (err) => {
    if (err) console.error('Error creating archived_jobs table:', err);
    else console.log('✅ Archived jobs table created');
  });

  // Close database
  setTimeout(() => {
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
      else console.log('✅ Archived jobs table setup complete');
    });
  }, 1000);
});