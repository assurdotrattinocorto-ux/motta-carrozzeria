const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('Creating job_assignments table...');

db.serialize(() => {
  // Job assignments table for many-to-many relationship
  db.run(`CREATE TABLE IF NOT EXISTS job_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER NOT NULL,
    FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users (id),
    UNIQUE(job_id, user_id)
  )`, (err) => {
    if (err) console.error('Error creating job_assignments table:', err);
    else console.log('✅ Job assignments table created');
  });

  // Migrate existing job assignments from jobs.assigned_to to job_assignments table
  console.log('Migrating existing job assignments...');
  
  db.all(`SELECT id, assigned_to, created_by FROM jobs WHERE assigned_to IS NOT NULL`, [], (err, jobs) => {
    if (err) {
      console.error('Error fetching existing jobs:', err);
      return;
    }

    if (jobs.length === 0) {
      console.log('✅ No existing job assignments to migrate');
      closeDatabase();
      return;
    }

    let migratedCount = 0;
    const totalJobs = jobs.length;

    jobs.forEach(job => {
      db.run(
        `INSERT OR IGNORE INTO job_assignments (job_id, user_id, assigned_by) VALUES (?, ?, ?)`,
        [job.id, job.assigned_to, job.created_by],
        function(err) {
          if (err) {
            console.error(`Error migrating job ${job.id}:`, err);
          } else if (this.changes > 0) {
            console.log(`✅ Migrated job ${job.id} assignment`);
          }
          
          migratedCount++;
          if (migratedCount === totalJobs) {
            console.log(`✅ Migration complete: ${migratedCount} jobs processed`);
            closeDatabase();
          }
        }
      );
    });
  });

  function closeDatabase() {
    setTimeout(() => {
      db.close((err) => {
        if (err) console.error('Error closing database:', err);
        else console.log('✅ Job assignments table setup complete');
      });
    }, 1000);
  }
});