const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('=== CONTROLLO SCHEMA TABELLA USERS ===\n');

// Controllo schema della tabella users
db.all("PRAGMA table_info(users)", (err, columns) => {
    if (err) {
        console.error('Errore nel recuperare lo schema:', err);
        return;
    }
    
    console.log('📋 STRUTTURA TABELLA USERS:');
    columns.forEach(col => {
        console.log(`   ${col.name} (${col.type}) - ${col.notnull ? 'NOT NULL' : 'NULL'} - ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // Ora recuperiamo tutti i dati usando solo le colonne esistenti
    db.all("SELECT * FROM users", (err, users) => {
        if (err) {
            console.error('Errore nel recuperare gli utenti:', err);
            return;
        }
        
        console.log(`\n📊 UTENTI PRESENTI: ${users.length}`);
        if (users.length > 0) {
            console.log('\n--- Dettagli utenti ---');
            users.forEach((user, index) => {
                console.log(`${index + 1}. Tutti i campi:`);
                Object.keys(user).forEach(key => {
                    console.log(`   ${key}: ${user[key]}`);
                });
                console.log('   ---');
            });
        }
        
        db.close();
    });
});