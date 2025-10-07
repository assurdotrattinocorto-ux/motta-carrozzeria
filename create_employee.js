const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('database.db');

console.log('=== CREAZIONE UTENTE DIPENDENTE ===');

// Hash della password dipendente123
const hashedPassword = bcrypt.hashSync('dipendente123', 10);
console.log('Password hashata per dipendente:', hashedPassword);

// Prima verifico se l'utente dipendente esiste già
db.get("SELECT id FROM users WHERE email = 'dipendente@motta.it'", (err, row) => {
  if (err) {
    console.error('Errore nella verifica:', err);
    db.close();
    return;
  }
  
  if (row) {
    console.log('Utente dipendente già esistente con ID:', row.id);
    db.close();
    return;
  }
  
  // Inserisco il nuovo utente dipendente
  db.run(`INSERT INTO users (email, password, name, role, created_at) 
          VALUES ('dipendente@motta.it', ?, 'Mario Rossi', 'employee', datetime('now'))`, 
          [hashedPassword], 
          function(err) {
            if (err) {
              console.error('Errore nell\'inserimento del dipendente:', err);
            } else {
              console.log('✅ Utente dipendente creato con ID:', this.lastID);
            }
            
            // Verifica finale di tutti gli utenti
            db.all("SELECT id, email, name, role, created_at FROM users ORDER BY id", (err, users) => {
              if (err) {
                console.error('Errore nella verifica finale:', err);
              } else {
                console.log('\n=== UTENTI NEL DATABASE ===');
                users.forEach(user => {
                  console.log(`ID: ${user.id} | Email: ${user.email} | Nome: ${user.name} | Ruolo: ${user.role}`);
                });
              }
              db.close();
            });
          });
});