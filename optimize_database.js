const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Database connection
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Iniziando ottimizzazione database...');

// Indici per ottimizzare le query più frequenti
const optimizationQueries = [
  // Indici per la tabella users
  {
    name: 'idx_users_email',
    query: 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    description: 'Ottimizza login e ricerca utenti per email'
  },
  {
    name: 'idx_users_role',
    query: 'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
    description: 'Ottimizza filtri per ruolo utente'
  },

  // Indici per la tabella jobs
  {
    name: 'idx_jobs_status',
    query: 'CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)',
    description: 'Ottimizza filtri per status dei lavori'
  },
  {
    name: 'idx_jobs_assigned_to',
    query: 'CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON jobs(assigned_to)',
    description: 'Ottimizza ricerca lavori per dipendente assegnato'
  },
  {
    name: 'idx_jobs_created_by',
    query: 'CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by)',
    description: 'Ottimizza ricerca lavori per creatore'
  },
  {
    name: 'idx_jobs_created_at',
    query: 'CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC)',
    description: 'Ottimizza ordinamento per data creazione (più recenti primi)'
  },
  {
    name: 'idx_jobs_customer_name',
    query: 'CREATE INDEX IF NOT EXISTS idx_jobs_customer_name ON jobs(customer_name)',
    description: 'Ottimizza ricerca per nome cliente'
  },

  // Indici per la tabella time_logs
  {
    name: 'idx_time_logs_job_id',
    query: 'CREATE INDEX IF NOT EXISTS idx_time_logs_job_id ON time_logs(job_id)',
    description: 'Ottimizza ricerca time logs per lavoro'
  },
  {
    name: 'idx_time_logs_user_id',
    query: 'CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON time_logs(user_id)',
    description: 'Ottimizza ricerca time logs per utente'
  },
  {
    name: 'idx_time_logs_active',
    query: 'CREATE INDEX IF NOT EXISTS idx_time_logs_active ON time_logs(user_id, job_id, end_time)',
    description: 'Ottimizza ricerca timer attivi (end_time IS NULL)'
  },
  {
    name: 'idx_time_logs_start_time',
    query: 'CREATE INDEX IF NOT EXISTS idx_time_logs_start_time ON time_logs(start_time)',
    description: 'Ottimizza raggruppamenti per data'
  },

  // Indici per la tabella calendar_events
  {
    name: 'idx_calendar_events_date',
    query: 'CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date, event_time)',
    description: 'Ottimizza ordinamento eventi per data e ora'
  },
  {
    name: 'idx_calendar_events_created_by',
    query: 'CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by)',
    description: 'Ottimizza filtri per creatore evento'
  },

  // Indici per la tabella employees
  {
    name: 'idx_employees_user_id',
    query: 'CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id)',
    description: 'Ottimizza join con tabella users'
  },
  {
    name: 'idx_employees_code',
    query: 'CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code)',
    description: 'Ottimizza ricerca per codice dipendente'
  },
  {
    name: 'idx_employees_name',
    query: 'CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(last_name, first_name)',
    description: 'Ottimizza ordinamento per nome'
  },
  {
    name: 'idx_employees_status',
    query: 'CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)',
    description: 'Ottimizza filtri per status dipendente'
  },

  // Indici per la tabella customers
  {
    name: 'idx_customers_name',
    query: 'CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)',
    description: 'Ottimizza ordinamento e ricerca per nome cliente'
  },
  {
    name: 'idx_customers_email',
    query: 'CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)',
    description: 'Ottimizza ricerca per email cliente'
  }
];

// Funzione per eseguire le ottimizzazioni
async function optimizeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      let completed = 0;
      const total = optimizationQueries.length;

      // Analizza prima le tabelle esistenti
      console.log('📊 Analizzando struttura database...');
      
      optimizationQueries.forEach((optimization, index) => {
        db.run(optimization.query, (err) => {
          if (err) {
            console.error(`❌ Errore creando ${optimization.name}:`, err.message);
          } else {
            console.log(`✅ ${optimization.name}: ${optimization.description}`);
          }
          
          completed++;
          if (completed === total) {
            // Esegui ANALYZE per aggiornare le statistiche
            console.log('📈 Aggiornando statistiche database...');
            db.run('ANALYZE', (err) => {
              if (err) {
                console.error('❌ Errore durante ANALYZE:', err.message);
                reject(err);
              } else {
                console.log('✅ Statistiche database aggiornate');
                resolve();
              }
            });
          }
        });
      });
    });
  });
}

// Funzione per verificare gli indici creati
function verifyIndexes() {
  return new Promise((resolve, reject) => {
    db.all("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'", (err, indexes) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log('\n📋 Indici creati:');
      indexes.forEach(index => {
        console.log(`  • ${index.name} su tabella ${index.tbl_name}`);
      });
      
      resolve(indexes);
    });
  });
}

// Esegui ottimizzazione
async function main() {
  try {
    await optimizeDatabase();
    await verifyIndexes();
    
    console.log('\n🎉 Ottimizzazione database completata!');
    console.log('💡 Le query dovrebbero ora essere più veloci.');
    
  } catch (error) {
    console.error('❌ Errore durante ottimizzazione:', error);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('❌ Errore chiudendo database:', err.message);
      } else {
        console.log('🔒 Connessione database chiusa');
      }
    });
  }
}

// Avvia se eseguito direttamente
if (require.main === module) {
  main();
}

module.exports = { optimizeDatabase, verifyIndexes };