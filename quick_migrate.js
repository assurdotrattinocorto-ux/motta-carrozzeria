require('dotenv').config();
const { Client } = require('pg');
const sqlite3 = require('sqlite3').verbose();

async function quickMigrate() {
    console.log('🚀 Migrazione rapida SQLite → PostgreSQL');
    
    // Configurazione PostgreSQL
    const pgClient = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        },
        connectionTimeoutMillis: 30000,
        query_timeout: 30000,
        statement_timeout: 30000,
        idle_in_transaction_session_timeout: 30000
    });

    try {
        console.log('📡 Connessione a PostgreSQL...');
        await pgClient.connect();
        console.log('✅ Connesso a PostgreSQL!');

        // Test connessione
        const result = await pgClient.query('SELECT NOW() as current_time');
        console.log('⏰ Timestamp database:', result.rows[0].current_time);

        // Creazione tabelle
        console.log('🏗️  Creazione tabelle...');
        
        // Tabella quotes
        await pgClient.query(`
            CREATE TABLE IF NOT EXISTS quotes (
                id SERIAL PRIMARY KEY,
                text TEXT NOT NULL,
                author VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabella quotes creata');

        // Tabella users
        await pgClient.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabella users creata');

        // Migrazione dati da SQLite
        console.log('📦 Migrazione dati da SQLite...');
        
        const db = new sqlite3.Database('./database.db');
        
        // Migrazione quotes
        const quotes = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM quotes', (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        if (quotes.length > 0) {
            for (const quote of quotes) {
                await pgClient.query(
                    'INSERT INTO quotes (text, author, category, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
                    [quote.text, quote.author, quote.category, quote.created_at]
                );
            }
            console.log(`✅ Migrate ${quotes.length} citazioni`);
        } else {
            console.log('ℹ️  Nessuna citazione da migrare');
        }

        // Migrazione users
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        if (users.length > 0) {
            for (const user of users) {
                await pgClient.query(
                    'INSERT INTO users (username, email, password_hash, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
                    [user.username, user.email, user.password_hash, user.created_at]
                );
            }
            console.log(`✅ Migrati ${users.length} utenti`);
        } else {
            console.log('ℹ️  Nessun utente da migrare');
        }

        db.close();

        // Verifica finale
        const quotesCount = await pgClient.query('SELECT COUNT(*) FROM quotes');
        const usersCount = await pgClient.query('SELECT COUNT(*) FROM users');
        
        console.log('📊 Verifica finale:');
        console.log(`   - Citazioni: ${quotesCount.rows[0].count}`);
        console.log(`   - Utenti: ${usersCount.rows[0].count}`);
        
        console.log('🎉 Migrazione completata con successo!');

    } catch (error) {
        console.error('❌ Errore durante la migrazione:', error.message);
        throw error;
    } finally {
        await pgClient.end();
        console.log('🔌 Connessione PostgreSQL chiusa');
    }
}

quickMigrate().catch(console.error);