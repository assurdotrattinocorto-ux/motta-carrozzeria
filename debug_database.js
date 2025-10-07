const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('database.db');

console.log('=== DEBUG COMPLETO DATABASE ===');

// 1. Verifica struttura tabella users
console.log('\n1. STRUTTURA TABELLA USERS:');
db.all("PRAGMA table_info(users)", (err, columns) => {
  if (err) {
    console.error('Errore nel recupero struttura:', err);
  } else {
    console.log('Colonne della tabella users:');
    columns.forEach(col => {
      console.log(`- ${col.name}: ${col.type} (nullable: ${col.notnull === 0})`);
    });
  }
  
  // 2. Verifica tutti gli utenti
  console.log('\n2. TUTTI GLI UTENTI NEL DATABASE:');
  db.all("SELECT * FROM users ORDER BY id", (err, users) => {
    if (err) {
      console.error('Errore nel recupero utenti:', err);
    } else {
      console.log(`Trovati ${users.length} utenti:`);
      users.forEach(user => {
        console.log(`ID: ${user.id} | Email: ${user.email} | Nome: ${user.name} | Ruolo: ${user.role} | Password hash: ${user.password?.substring(0, 20)}...`);
      });
    }
    
    // 3. Test specifico per dipendente@motta.it
    console.log('\n3. TEST SPECIFICO PER dipendente@motta.it:');
    db.get("SELECT * FROM users WHERE email = ?", ['dipendente@motta.it'], (err, user) => {
      if (err) {
        console.error('Errore nella ricerca dipendente:', err);
      } else if (user) {
        console.log('Utente dipendente trovato:', user);
        
        // Test password
        const testPassword = 'dipendente123';
        const isPasswordValid = bcrypt.compareSync(testPassword, user.password);
        console.log(`Password "${testPassword}" valida: ${isPasswordValid}`);
      } else {
        console.log('Utente dipendente NON trovato!');
        
        // Creiamo l'utente dipendente
        console.log('\n4. CREAZIONE UTENTE DIPENDENTE:');
        const hashedPassword = bcrypt.hashSync('dipendente123', 10);
        
        db.run("INSERT INTO users (email, password, name, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))", 
          ['dipendente@motta.it', hashedPassword, 'Mario Rossi', 'employee'], 
          function(err) {
            if (err) {
              console.error('Errore nella creazione dipendente:', err);
            } else {
              console.log('✅ Dipendente creato con ID:', this.lastID);
              
              // Verifica finale
              console.log('\n5. VERIFICA FINALE:');
              db.all("SELECT id, email, name, role FROM users ORDER BY id", (err, finalUsers) => {
                if (err) {
                  console.error('Errore verifica finale:', err);
                } else {
                  console.log('Utenti finali:');
                  finalUsers.forEach(u => {
                    console.log(`- ID: ${u.id}, Email: ${u.email}, Nome: ${u.name}, Ruolo: ${u.role}`);
                  });
                }
                db.close();
              });
            }
          });
      }
    });
  });
});