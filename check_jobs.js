const sqlite3 = require('sqlite3').verbose();

// Apri il database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Errore nell\'apertura del database:', err.message);
  } else {
    console.log('Connesso al database SQLite.');
  }
});

// Controlla i lavori esistenti
console.log('Controllo lavori esistenti...');
db.all("SELECT * FROM jobs", [], (err, rows) => {
  if (err) {
    console.error('Errore nel recupero dei lavori:', err.message);
  } else {
    console.log('Lavori trovati:', rows.length);
    rows.forEach((row) => {
      console.log(`ID: ${row.id}, Titolo: ${row.title}, Assegnato a: ${row.assigned_to}, Stato: ${row.status}`);
    });
  }
});

// Controlla gli utenti/dipendenti esistenti
console.log('\nControllo utenti esistenti...');
db.all("SELECT * FROM users", [], (err, rows) => {
  if (err) {
    console.error('Errore nel recupero degli utenti:', err.message);
  } else {
    console.log('Utenti trovati:', rows.length);
    rows.forEach((row) => {
      console.log(`ID: ${row.id}, Nome: ${row.name}, Email: ${row.email}, Ruolo: ${row.role}`);
    });
  }
});

// Chiudi il database
db.close((err) => {
  if (err) {
    console.error('Errore nella chiusura del database:', err.message);
  } else {
    console.log('Database chiuso.');
  }
});