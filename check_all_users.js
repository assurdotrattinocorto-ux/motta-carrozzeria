const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('=== CONTROLLO COMPLETO UTENTI NEL DATABASE ===\n');

// Controllo tabella users
db.all("SELECT * FROM users", (err, users) => {
    if (err) {
        console.error('Errore nel recuperare gli utenti:', err);
        return;
    }
    
    console.log(`📊 UTENTI NELLA TABELLA 'users': ${users.length}`);
    if (users.length > 0) {
        console.log('\n--- Dettagli utenti ---');
        users.forEach((user, index) => {
            console.log(`${index + 1}. ID: ${user.id}`);
            console.log(`   Username: ${user.username}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Ruolo: ${user.role}`);
            console.log(`   Creato: ${user.created_at}`);
            console.log(`   Password hash presente: ${user.password ? 'Sì' : 'No'}`);
            console.log('   ---');
        });
    } else {
        console.log('❌ NESSUN UTENTE TROVATO nella tabella users!');
    }
    
    // Controllo tabella employees
    db.all("SELECT * FROM employees", (err, employees) => {
        if (err) {
            console.error('Errore nel recuperare i dipendenti:', err);
            return;
        }
        
        console.log(`\n📊 DIPENDENTI NELLA TABELLA 'employees': ${employees.length}`);
        if (employees.length > 0) {
            console.log('\n--- Dettagli dipendenti ---');
            employees.forEach((emp, index) => {
                console.log(`${index + 1}. ID: ${emp.id}`);
                console.log(`   User ID: ${emp.user_id}`);
                console.log(`   Codice: ${emp.employee_code}`);
                console.log(`   Nome: ${emp.first_name} ${emp.last_name}`);
                console.log(`   Posizione: ${emp.position}`);
                console.log(`   Dipartimento: ${emp.department}`);
                console.log('   ---');
            });
        } else {
            console.log('❌ NESSUN DIPENDENTE TROVATO nella tabella employees!');
        }
        
        // Controllo se ci sono utenti admin
        db.all("SELECT * FROM users WHERE role = 'admin'", (err, admins) => {
            if (err) {
                console.error('Errore nel cercare admin:', err);
                return;
            }
            
            console.log(`\n👑 UTENTI ADMIN: ${admins.length}`);
            if (admins.length === 0) {
                console.log('❌ NESSUN ADMIN TROVATO!');
            }
            
            // Controllo se ci sono utenti dipendenti
            db.all("SELECT * FROM users WHERE role = 'employee'", (err, empUsers) => {
                if (err) {
                    console.error('Errore nel cercare dipendenti:', err);
                    return;
                }
                
                console.log(`\n👷 UTENTI DIPENDENTI: ${empUsers.length}`);
                if (empUsers.length === 0) {
                    console.log('❌ NESSUN UTENTE DIPENDENTE TROVATO!');
                }
                
                console.log('\n=== RIEPILOGO ===');
                console.log(`Totale utenti: ${users.length}`);
                console.log(`Admin: ${admins.length}`);
                console.log(`Dipendenti (users): ${empUsers.length}`);
                console.log(`Dipendenti (employees): ${employees.length}`);
                
                if (users.length === 0) {
                    console.log('\n🚨 PROBLEMA IDENTIFICATO: Tutti gli utenti sono stati rimossi!');
                    console.log('   Questo spiega perché non riuscite più ad accedere.');
                    console.log('   Sarà necessario ricreare gli utenti admin e dipendenti.');
                }
                
                db.close();
            });
        });
    });
});