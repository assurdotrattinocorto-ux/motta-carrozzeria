const { Client } = require('pg');
require('dotenv').config();

let client;
let isConnected = false;

async function maintainConnection() {
    try {
        if (!client || !isConnected) {
            client = new Client({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 10000,
                query_timeout: 10000
            });

            console.log('🔄 Tentativo di connessione...');
            await client.connect();
            isConnected = true;
            console.log('✅ Connesso al database Render!');
            
            // Query di test per mantenere attiva la connessione
            const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
            console.log('📊 Database attivo:', result.rows[0].current_time);
            console.log('🔧 Versione PostgreSQL:', result.rows[0].pg_version.split(' ')[0]);
        }
        
        // Query periodica per mantenere la connessione
        if (isConnected) {
            await client.query('SELECT 1');
            console.log('💓 Heartbeat inviato');
        }
        
    } catch (error) {
        console.error('❌ Errore connessione:', error.message);
        isConnected = false;
        if (client) {
            try {
                await client.end();
            } catch (e) {
                // Ignora errori di chiusura
            }
            client = null;
        }
    }
}

// Mantieni la connessione attiva
console.log('🚀 Avvio mantenimento connessione database Render...');
maintainConnection();

// Heartbeat ogni 30 secondi
const interval = setInterval(maintainConnection, 30000);

// Gestione chiusura pulita
process.on('SIGINT', async () => {
    console.log('\n🛑 Chiusura in corso...');
    clearInterval(interval);
    if (client && isConnected) {
        await client.end();
        console.log('🔌 Connessione chiusa');
    }
    process.exit(0);
});

// Mantieni il processo attivo per 5 minuti
setTimeout(() => {
    console.log('⏰ Timeout raggiunto, chiusura automatica...');
    clearInterval(interval);
    if (client && isConnected) {
        client.end().then(() => {
            console.log('🔌 Connessione chiusa');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
}, 300000); // 5 minuti