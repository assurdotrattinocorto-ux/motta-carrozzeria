const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('Creating invoices table...');

db.serialize(() => {
  // Invoices table
  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER,
    job_id INTEGER NOT NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'overdue'
    labor_hours REAL DEFAULT 0,
    labor_rate REAL DEFAULT 0,
    labor_total REAL DEFAULT 0,
    parts_total REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0.22,
    tax_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    notes TEXT,
    payment_method TEXT DEFAULT 'bank_transfer',
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    paid_at DATETIME,
    FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE SET NULL,
    FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`, (err) => {
    if (err) console.error('Error creating invoices table:', err);
    else console.log('✅ Invoices table created');
  });

  // Invoice items table (for detailed breakdown of invoice items)
  db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'labor' or 'part'
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('Error creating invoice_items table:', err);
    else console.log('✅ Invoice items table created');
  });

  // Create indexes for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id)`, (err) => {
    if (err) console.error('Error creating invoices job_id index:', err);
    else console.log('✅ Invoices job_id index created');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices(quote_id)`, (err) => {
    if (err) console.error('Error creating invoices quote_id index:', err);
    else console.log('✅ Invoices quote_id index created');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`, (err) => {
    if (err) console.error('Error creating invoices status index:', err);
    else console.log('✅ Invoices status index created');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)`, (err) => {
    if (err) console.error('Error creating invoice_items invoice_id index:', err);
    else console.log('✅ Invoice items invoice_id index created');
  });

  // Close database after all operations
  setTimeout(() => {
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
      else console.log('✅ Invoices table setup complete');
    });
  }, 1000);
});