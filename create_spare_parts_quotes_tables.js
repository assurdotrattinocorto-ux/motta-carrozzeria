const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('Creating spare parts and quotes tables...');

db.serialize(() => {
  // Spare parts table
  db.run(`CREATE TABLE IF NOT EXISTS spare_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    part_number TEXT,
    supplier TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('Error creating spare_parts table:', err);
    else console.log('✅ Spare parts table created');
  });

  // Quotes table
  db.run(`CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    quote_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'draft',
    labor_hours REAL DEFAULT 0,
    labor_rate REAL DEFAULT 0,
    labor_total REAL DEFAULT 0,
    parts_total REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0.22,
    tax_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    notes TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    approved_at DATETIME,
    rejected_at DATETIME,
    FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`, (err) => {
    if (err) console.error('Error creating quotes table:', err);
    else console.log('✅ Quotes table created');
  });

  // Quote items table (for detailed breakdown of quote items)
  db.run(`CREATE TABLE IF NOT EXISTS quote_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'labor' or 'part'
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('Error creating quote_items table:', err);
    else console.log('✅ Quote items table created');
  });

  // Create indexes for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_spare_parts_job_id ON spare_parts(job_id)`, (err) => {
    if (err) console.error('Error creating spare_parts job_id index:', err);
    else console.log('✅ Spare parts job_id index created');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_quotes_job_id ON quotes(job_id)`, (err) => {
    if (err) console.error('Error creating quotes job_id index:', err);
    else console.log('✅ Quotes job_id index created');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status)`, (err) => {
    if (err) console.error('Error creating quotes status index:', err);
    else console.log('✅ Quotes status index created');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id)`, (err) => {
    if (err) console.error('Error creating quote_items quote_id index:', err);
    else console.log('✅ Quote items quote_id index created');
  });

  // Close database after all operations
  setTimeout(() => {
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
      else console.log('✅ Spare parts and quotes tables setup complete');
    });
  }, 1000);
});