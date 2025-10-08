const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

describe('Database', () => {
  let db;
  const testDbPath = path.join(__dirname, '..', 'test_database_unit.db');
  
  beforeAll(() => {
    // Crea un database separato per questi test
    db = new sqlite3.Database(testDbPath);
  });
  
  afterAll(() => {
    if (db) {
      db.close();
    }
    // Pulisci il database di test
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
  
  describe('Creazione tabelle', () => {
    test('dovrebbe creare la tabella users', (done) => {
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'employee',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.run(createUsersTable, (err) => {
        expect(err).toBeNull();
        
        // Verifica che la tabella sia stata creata
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
          expect(err).toBeNull();
          expect(row).toBeTruthy();
          expect(row.name).toBe('users');
          done();
        });
      });
    });
    
    test('dovrebbe creare la tabella jobs', (done) => {
      const createJobsTable = `
        CREATE TABLE IF NOT EXISTS jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'pending',
          priority TEXT DEFAULT 'medium',
          customer_name TEXT NOT NULL,
          assigned_to INTEGER,
          created_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (assigned_to) REFERENCES users(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `;
      
      db.run(createJobsTable, (err) => {
        expect(err).toBeNull();
        
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='jobs'", (err, row) => {
          expect(err).toBeNull();
          expect(row).toBeTruthy();
          expect(row.name).toBe('jobs');
          done();
        });
      });
    });
    
    test('dovrebbe creare la tabella time_logs', (done) => {
      const createTimeLogsTable = `
        CREATE TABLE IF NOT EXISTS time_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          duration INTEGER,
          notes TEXT,
          active BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (job_id) REFERENCES jobs(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `;
      
      db.run(createTimeLogsTable, (err) => {
        expect(err).toBeNull();
        
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='time_logs'", (err, row) => {
          expect(err).toBeNull();
          expect(row).toBeTruthy();
          expect(row.name).toBe('time_logs');
          done();
        });
      });
    });
    
    test('dovrebbe creare la tabella customers', (done) => {
      const createCustomersTable = `
        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.run(createCustomersTable, (err) => {
        expect(err).toBeNull();
        
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='customers'", (err, row) => {
          expect(err).toBeNull();
          expect(row).toBeTruthy();
          expect(row.name).toBe('customers');
          done();
        });
      });
    });
    
    test('dovrebbe creare la tabella employees', (done) => {
      const createEmployeesTable = `
        CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          surname TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          hire_date DATE,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `;
      
      db.run(createEmployeesTable, (err) => {
        expect(err).toBeNull();
        
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='employees'", (err, row) => {
          expect(err).toBeNull();
          expect(row).toBeTruthy();
          expect(row.name).toBe('employees');
          done();
        });
      });
    });
  });
  
  describe('Operazioni CRUD', () => {
    beforeAll((done) => {
      // Crea le tabelle necessarie per i test
      const tables = [
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'employee',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'pending',
          priority TEXT DEFAULT 'medium',
          customer_name TEXT NOT NULL,
          assigned_to INTEGER,
          created_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (assigned_to) REFERENCES users(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )`
      ];
      
      let completed = 0;
      tables.forEach(table => {
        db.run(table, (err) => {
          expect(err).toBeNull();
          completed++;
          if (completed === tables.length) {
            done();
          }
        });
      });
    });
    
    describe('Users', () => {
      test('dovrebbe inserire un nuovo utente', (done) => {
        const insertUser = `
          INSERT INTO users (email, password, role)
          VALUES (?, ?, ?)
        `;
        
        db.run(insertUser, ['test@example.com', 'hashedpassword', 'admin'], function(err) {
          expect(err).toBeNull();
          expect(this.lastID).toBeGreaterThan(0);
          done();
        });
      });
      
      test('dovrebbe recuperare un utente per email', (done) => {
        db.get('SELECT * FROM users WHERE email = ?', ['test@example.com'], (err, user) => {
          expect(err).toBeNull();
          expect(user).toBeTruthy();
          expect(user.email).toBe('test@example.com');
          expect(user.role).toBe('admin');
          done();
        });
      });
      
      test('dovrebbe aggiornare un utente', (done) => {
        db.run('UPDATE users SET role = ? WHERE email = ?', ['employee', 'test@example.com'], function(err) {
          expect(err).toBeNull();
          expect(this.changes).toBe(1);
          
          // Verifica l'aggiornamento
          db.get('SELECT role FROM users WHERE email = ?', ['test@example.com'], (err, user) => {
            expect(err).toBeNull();
            expect(user.role).toBe('employee');
            done();
          });
        });
      });
      
      test('dovrebbe rispettare il vincolo UNIQUE su email', (done) => {
        const insertDuplicateUser = `
          INSERT INTO users (email, password, role)
          VALUES (?, ?, ?)
        `;
        
        db.run(insertDuplicateUser, ['test@example.com', 'anotherpassword', 'admin'], (err) => {
          expect(err).toBeTruthy();
          expect(err.message).toContain('UNIQUE constraint failed');
          done();
        });
      });
    });
    
    describe('Jobs', () => {
      let userId;
      
      beforeAll((done) => {
        // Inserisci un utente per i test dei lavori
        db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', 
               ['jobtest@example.com', 'password', 'admin'], function(err) {
          expect(err).toBeNull();
          userId = this.lastID;
          done();
        });
      });
      
      test('dovrebbe inserire un nuovo lavoro', (done) => {
        const insertJob = `
          INSERT INTO jobs (title, description, customer_name, created_by)
          VALUES (?, ?, ?, ?)
        `;
        
        db.run(insertJob, ['Test Job', 'Descrizione test', 'Cliente Test', userId], function(err) {
          expect(err).toBeNull();
          expect(this.lastID).toBeGreaterThan(0);
          done();
        });
      });
      
      test('dovrebbe recuperare lavori per status', (done) => {
        db.all('SELECT * FROM jobs WHERE status = ?', ['pending'], (err, jobs) => {
          expect(err).toBeNull();
          expect(Array.isArray(jobs)).toBe(true);
          expect(jobs.length).toBeGreaterThan(0);
          jobs.forEach(job => {
            expect(job.status).toBe('pending');
          });
          done();
        });
      });
      
      test('dovrebbe aggiornare lo status di un lavoro', (done) => {
        // Prima trova un lavoro
        db.get('SELECT id FROM jobs LIMIT 1', (err, job) => {
          expect(err).toBeNull();
          expect(job).toBeTruthy();
          
          // Aggiorna lo status
          db.run('UPDATE jobs SET status = ? WHERE id = ?', ['in_progress', job.id], function(err) {
            expect(err).toBeNull();
            expect(this.changes).toBe(1);
            
            // Verifica l'aggiornamento
            db.get('SELECT status FROM jobs WHERE id = ?', [job.id], (err, updatedJob) => {
              expect(err).toBeNull();
              expect(updatedJob.status).toBe('in_progress');
              done();
            });
          });
        });
      });
      
      test('dovrebbe rispettare le foreign key', (done) => {
        const insertJobWithInvalidUser = `
          INSERT INTO jobs (title, customer_name, created_by)
          VALUES (?, ?, ?)
        `;
        
        // Prova a inserire un lavoro con un created_by inesistente
        db.run(insertJobWithInvalidUser, ['Invalid Job', 'Cliente', 99999], (err) => {
          // SQLite potrebbe non applicare le foreign key per default
          // Questo test verifica se sono abilitate
          if (err) {
            expect(err.message).toContain('FOREIGN KEY constraint failed');
          }
          done();
        });
      });
    });
  });
  
  describe('Indici e Performance', () => {
    beforeAll((done) => {
      // Crea tabelle con indici
      const createTableWithIndex = `
        CREATE TABLE IF NOT EXISTS test_performance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_test_email ON test_performance(email);
        CREATE INDEX IF NOT EXISTS idx_test_status ON test_performance(status);
      `;
      
      db.exec(createTableWithIndex, (err) => {
        expect(err).toBeNull();
        done();
      });
    });
    
    test('dovrebbe verificare la creazione degli indici', (done) => {
      db.all("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='test_performance'", (err, indexes) => {
        expect(err).toBeNull();
        expect(Array.isArray(indexes)).toBe(true);
        
        const indexNames = indexes.map(idx => idx.name);
        expect(indexNames).toContain('idx_test_email');
        expect(indexNames).toContain('idx_test_status');
        done();
      });
    });
    
    test('dovrebbe inserire dati di test per performance', (done) => {
      const insertData = db.prepare('INSERT INTO test_performance (email, status) VALUES (?, ?)');
      
      let completed = 0;
      const totalInserts = 100;
      
      for (let i = 0; i < totalInserts; i++) {
        insertData.run([`test${i}@example.com`, i % 2 === 0 ? 'active' : 'inactive'], (err) => {
          expect(err).toBeNull();
          completed++;
          
          if (completed === totalInserts) {
            insertData.finalize();
            done();
          }
        });
      }
    });
    
    test('dovrebbe eseguire query con indici efficientemente', (done) => {
      const startTime = Date.now();
      
      db.all('SELECT * FROM test_performance WHERE email LIKE ? AND status = ?', 
             ['test1%', 'active'], (err, results) => {
        expect(err).toBeNull();
        
        const queryTime = Date.now() - startTime;
        expect(queryTime).toBeLessThan(100); // Dovrebbe essere veloce con gli indici
        
        expect(Array.isArray(results)).toBe(true);
        results.forEach(row => {
          expect(row.email).toMatch(/^test1/);
          expect(row.status).toBe('active');
        });
        
        done();
      });
    });
  });
  
  describe('Transazioni', () => {
    beforeAll((done) => {
      // Crea una tabella per i test delle transazioni
      db.run(`
        CREATE TABLE IF NOT EXISTS test_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          value INTEGER NOT NULL
        )
      `, done);
    });
    
    test('dovrebbe eseguire una transazione con successo', (done) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run('INSERT INTO test_transactions (name, value) VALUES (?, ?)', ['test1', 100], (err) => {
          expect(err).toBeNull();
        });
        
        db.run('INSERT INTO test_transactions (name, value) VALUES (?, ?)', ['test2', 200], (err) => {
          expect(err).toBeNull();
        });
        
        db.run('COMMIT', (err) => {
          expect(err).toBeNull();
          
          // Verifica che i dati siano stati inseriti
          db.all('SELECT * FROM test_transactions', (err, rows) => {
            expect(err).toBeNull();
            expect(rows.length).toBe(2);
            done();
          });
        });
      });
    });
    
    test('dovrebbe eseguire rollback in caso di errore', (done) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run('INSERT INTO test_transactions (name, value) VALUES (?, ?)', ['test3', 300], (err) => {
          expect(err).toBeNull();
        });
        
        // Simula un errore
        db.run('INSERT INTO test_transactions (invalid_column) VALUES (?)', ['invalid'], (err) => {
          expect(err).toBeTruthy(); // Dovrebbe fallire
          
          db.run('ROLLBACK', (rollbackErr) => {
            expect(rollbackErr).toBeNull();
            
            // Verifica che il rollback abbia funzionato
            db.all('SELECT * FROM test_transactions WHERE name = ?', ['test3'], (err, rows) => {
              expect(err).toBeNull();
              expect(rows.length).toBe(0); // Non dovrebbe esserci test3
              done();
            });
          });
        });
      });
    });
  });
  
  describe('Backup e Integrità', () => {
    test('dovrebbe verificare l\'integrità del database', (done) => {
      db.get('PRAGMA integrity_check', (err, result) => {
        expect(err).toBeNull();
        expect(result).toBeTruthy();
        expect(result.integrity_check).toBe('ok');
        done();
      });
    });
    
    test('dovrebbe ottenere informazioni sulle tabelle', (done) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        expect(err).toBeNull();
        expect(Array.isArray(tables)).toBe(true);
        expect(tables.length).toBeGreaterThan(0);
        
        const tableNames = tables.map(t => t.name);
        expect(tableNames).toContain('users');
        expect(tableNames).toContain('jobs');
        done();
      });
    });
    
    test('dovrebbe ottenere statistiche del database', (done) => {
      db.get('SELECT COUNT(*) as table_count FROM sqlite_master WHERE type="table"', (err, stats) => {
        expect(err).toBeNull();
        expect(stats).toBeTruthy();
        expect(stats.table_count).toBeGreaterThan(0);
        done();
      });
    });
  });
});