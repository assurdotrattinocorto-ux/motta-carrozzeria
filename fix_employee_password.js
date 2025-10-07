const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('database.db');

console.log('=== CORREZIONE PASSWORD DIPENDENTE ===');

// Hash corretto della password dipendente123
const correctHashedPassword = bcrypt.hashSync('dipendente123', 10);
console.log('Nuovo hash password:', correctHashedPassword);

// Aggiorna la password dell'utente dipendente
db.run("UPDATE users SET password = ? WHERE email = 'dipendente@motta.it'", 
  [correctHashedPassword], 
  function(err) {
    if (err) {
      console.error('Errore nell\'aggiornamento password:', err);
    } else {
      console.log('✅ Password dipendente aggiornata. Righe modificate:', this.changes);
    }
    
    // Verifica che la password sia stata aggiornata correttamente
    db.get("SELECT * FROM users WHERE email = 'dipendente@motta.it'", (err, user) => {
      if (err) {
        console.error('Errore nella verifica:', err);
      } else if (user) {
        console.log('\nUtente dipendente dopo aggiornamento:');
        console.log(`ID: ${user.id} | Email: ${user.email} | Nome: ${user.name}`);
        
        // Test della password
        const isPasswordValid = bcrypt.compareSync('dipendente123', user.password);
        console.log(`Password "dipendente123" ora valida: ${isPasswordValid}`);
        
        if (isPasswordValid) {
          console.log('✅ Password corretta! Il login dovrebbe funzionare ora.');
        } else {
          console.log('❌ Problema persistente con la password.');
        }
      } else {
        console.log('❌ Utente dipendente non trovato dopo aggiornamento.');
      }
      
      db.close();
    });
  });