const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('Checking database tables...');

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
  if (err) {
    console.error('Database error:', err);
  } else {
    console.log('Tables found:', rows);
  }
  
  // Try to check if customers table exists specifically
  db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='customers'", (err, row) => {
    if (err) {
      console.error('Error checking customers table:', err);
    } else {
      console.log('Customers table exists:', row.count > 0);
    }
    db.close();
  });
});