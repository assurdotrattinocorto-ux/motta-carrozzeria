const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Usa lo stesso path del server
const dbPath = path.join(__dirname, 'database.db');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath);

console.log('=== VERIFICA CREAZIONE ADMIN ===');

// Simula la logica del server
const adminEmail = 'admin@motta.it';
const adminPassword = bcrypt.hashSync('admin123', 10);

console.log('1. Controllo se admin esiste già...');
db.get("SELECT id FROM users WHERE email = ?", [adminEmail], (err, row) => {
  if (err) {
    console.error('Errore:', err);
    return;
  }
  
  console.log('Risultato query:', row);
  
  if (!row) {
    console.log('2. Admin non trovato, lo creo...');
    db.run("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)", 
      [adminEmail, adminPassword, 'Amministratore Motta', 'admin'], function(err) {
        if (err) {
          console.error('Errore nella creazione:', err);
        } else {
          console.log('✅ Admin creato con ID:', this.lastID);
        }
        
        // Verifica finale
        console.log('3. Verifica finale di tutti gli utenti:');
        db.all("SELECT * FROM users ORDER BY id", (err, users) => {
          if (err) {
            console.error('Errore nella verifica:', err);
          } else {
            console.log('Utenti trovati:', users.length);
            users.forEach(user => {
              console.log(`- ID: ${user.id}, Email: ${user.email}, Nome: ${user.name}, Ruolo: ${user.role}`);
            });
          }
          db.close();
        });
      });
  } else {
    console.log('2. Admin già esiste con ID:', row.id);
    
    // Verifica finale
    console.log('3. Verifica finale di tutti gli utenti:');
    db.all("SELECT * FROM users ORDER BY id", (err, users) => {
      if (err) {
        console.error('Errore nella verifica:', err);
      } else {
        console.log('Utenti trovati:', users.length);
        users.forEach(user => {
          console.log(`- ID: ${user.id}, Email: ${user.email}, Nome: ${user.name}, Ruolo: ${user.role}`);
        });
      }
      db.close();
    });
  }
});