const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('database.db');

console.log('=== CREAZIONE MANUALE UTENTE ADMIN ===');

// Hash della password admin123
const hashedPassword = bcrypt.hashSync('admin123', 10);
console.log('Password hashata:', hashedPassword);

// Prima elimino eventuali utenti admin esistenti
db.run("DELETE FROM users WHERE email = 'admin@motta.it'", function(err) {
  if (err) {
    console.error('Errore nell\'eliminazione:', err);
  } else {
    console.log('Eventuali admin precedenti eliminati:', this.changes);
  }
  
  // Inserisco il nuovo utente admin
  db.run(`INSERT INTO users (email, password, name, role, created_at) 
          VALUES ('admin@motta.it', ?, 'Amministratore Motta', 'admin', datetime('now'))`, 
          [hashedPassword], 
          function(err) {
            if (err) {
              console.error('Errore nell\'inserimento:', err);
            } else {
              console.log('✅ Utente admin creato con ID:', this.lastID);
            }
            
            // Verifica finale
            db.all("SELECT id, email, name, role, created_at FROM users ORDER BY id", (err, users) => {
              if (err) {
                console.error('Errore nella verifica:', err);
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