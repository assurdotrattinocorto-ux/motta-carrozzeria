const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('=== RIPRISTINO USERNAME UTENTI ===\n');

// Prima mostriamo la situazione attuale
db.all("SELECT id, username, email, role FROM users", (err, users) => {
    if (err) {
        console.error('Errore nel recuperare gli utenti:', err);
        return;
    }
    
    console.log('📊 SITUAZIONE ATTUALE:');
    users.forEach(user => {
        console.log(`   ID: ${user.id}, Username: "${user.username}", Email: ${user.email}, Ruolo: ${user.role}`);
    });
    
    console.log('\n🔧 RIPRISTINO USERNAME...\n');
    
    // Aggiorna l'admin
    db.run("UPDATE users SET username = 'admin' WHERE email = 'admin@motta.it' AND role = 'admin'", function(err) {
        if (err) {
            console.error('Errore nell\'aggiornare admin:', err);
            return;
        }
        console.log(`✅ Admin aggiornato (righe modificate: ${this.changes})`);
        
        // Aggiorna il dipendente
        db.run("UPDATE users SET username = 'dipendente' WHERE email = 'dipendente@motta.it' AND role = 'employee'", function(err) {
            if (err) {
                console.error('Errore nell\'aggiornare dipendente:', err);
                return;
            }
            console.log(`✅ Dipendente aggiornato (righe modificate: ${this.changes})`);
            
            // Verifica finale
            db.all("SELECT id, username, email, role FROM users", (err, updatedUsers) => {
                if (err) {
                    console.error('Errore nella verifica finale:', err);
                    return;
                }
                
                console.log('\n📊 SITUAZIONE DOPO IL RIPRISTINO:');
                updatedUsers.forEach(user => {
                    console.log(`   ID: ${user.id}, Username: "${user.username}", Email: ${user.email}, Ruolo: ${user.role}`);
                });
                
                console.log('\n🎉 RIPRISTINO COMPLETATO!');
                console.log('Ora dovreste poter accedere con:');
                console.log('   👑 Admin: username "admin", password "admin123"');
                console.log('   👷 Dipendente: username "dipendente", password "dipendente123"');
                
                db.close();
            });
        });
    });
});