// Database helper functions to handle SQLite and PostgreSQL differences

const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');

// Helper function to execute queries with proper syntax for both databases
function executeQuery(db, query, params = [], callback) {
  if (isPostgres) {
    // PostgreSQL uses $1, $2, etc. for parameters
    let pgQuery = query;
    let pgParams = params;
    
    // Convert ? placeholders to $1, $2, etc.
    let paramIndex = 1;
    pgQuery = query.replace(/\?/g, () => `$${paramIndex++}`);
    
    db.query(pgQuery, pgParams, (err, result) => {
      if (err) return callback(err);
      callback(null, result.rows);
    });
  } else {
    // SQLite
    db.all(query, params, callback);
  }
}

// Helper function to get a single row
function getOne(db, query, params = [], callback) {
  if (isPostgres) {
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = query.replace(/\?/g, () => `$${paramIndex++}`);
    
    db.query(pgQuery, params, (err, result) => {
      if (err) return callback(err);
      callback(null, result.rows[0] || null);
    });
  } else {
    db.get(query, params, callback);
  }
}

// Helper function to run INSERT/UPDATE/DELETE queries
function runQuery(db, query, params = [], callback) {
  if (isPostgres) {
    let pgQuery = query;
    let paramIndex = 1;
    pgQuery = query.replace(/\?/g, () => `$${paramIndex++}`);
    
    db.query(pgQuery, params, (err, result) => {
      if (err) return callback(err);
      // For INSERT queries, return the inserted ID if available
      const insertId = result.rows && result.rows[0] ? result.rows[0].id : null;
      callback(null, { insertId, changes: result.rowCount });
    });
  } else {
    db.run(query, params, function(err) {
      if (err) return callback(err);
      callback(null, { insertId: this.lastID, changes: this.changes });
    });
  }
}

// Helper function to get the correct AUTOINCREMENT syntax
function getAutoIncrementSyntax() {
  return isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
}

// Helper function to get the correct timestamp syntax
function getCurrentTimestamp() {
  return isPostgres ? 'CURRENT_TIMESTAMP' : "datetime('now')";
}

// Helper function to convert SQLite queries to PostgreSQL
function convertQuery(query) {
  if (!isPostgres) return query;
  
  // Convert common SQLite syntax to PostgreSQL
  return query
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
    .replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP')
    .replace(/AUTOINCREMENT/g, '')
    .replace(/TEXT/g, 'TEXT')
    .replace(/REAL/g, 'DECIMAL(10,2)');
}

module.exports = {
  executeQuery,
  getOne,
  runQuery,
  getAutoIncrementSyntax,
  getCurrentTimestamp,
  convertQuery,
  isPostgres
};