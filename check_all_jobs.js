const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

db.all('SELECT j.*, u.name as assigned_to_name FROM jobs j LEFT JOIN users u ON j.assigned_to = u.id ORDER BY j.id', (err, jobs) => {
  if (err) {
    console.error('Errore:', err);
  } else {
    console.log('=== TUTTI I LAVORI NEL DATABASE ===');
    console.log('Totale lavori:', jobs.length);
    jobs.forEach(job => {
      console.log(`ID: ${job.id} | Titolo: "${job.title}" | Assegnato a: ${job.assigned_to_name} (ID: ${job.assigned_to})`);
    });
  }
  db.close();
});