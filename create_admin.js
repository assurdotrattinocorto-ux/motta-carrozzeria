const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.db');

// Hash della password admin123
const hashedPassword = bcrypt.hashSync('admin123', 10);

// Inserisci l'utente admin con ID 1
db.run(`INSERT INTO users (id, email, password, name, role, created_at) 
        VALUES (1, 'admin@motta.it', ?, 'Amministratore Motta', 'admin', '2025-10-05 10:12:52')`, 
        [hashedPassword], 
        function(err) {
          if (err) {
            console.error('Errore nell\'inserimento dell\'admin:', err.message);
          } else {
            console.log('Utente admin creato con successo con ID:', this.lastID);
          }
          
          // Verifica che l'utente sia stato creato
          db.all("SELECT id, name, email, role FROM users ORDER BY id", (err, users) => {
            if (err) {
              console.error('Errore nella verifica:', err.message);
            } else {
              console.log('Utenti nel database:');
              users.forEach(user => {
                console.log(`- ID: ${user.id}, Nome: ${user.name}, Email: ${user.email}, Ruolo: ${user.role}`);
              });
            }
            db.close();
          });
        });