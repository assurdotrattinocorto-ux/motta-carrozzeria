const { Client } = require('pg');
require('dotenv').config();

async function wakeUpDatabase() {
    console.log('🔄 Attempting to wake up Render PostgreSQL database...');
    
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
        attempts++;
        console.log(`📡 Attempt ${attempts}/${maxAttempts}...`);
        
        // Create a new client for each attempt
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            },
            connectionTimeoutMillis: 30000,
            query_timeout: 30000,
            statement_timeout: 30000,
            idle_in_transaction_session_timeout: 30000,
            application_name: 'motta-wake-up'
        });
        
        try {
            await client.connect();
            console.log('✅ Connected to database!');
            
            // Simple query to wake up the database
            const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
            console.log('🕒 Database time:', result.rows[0].current_time);
            console.log('📊 PostgreSQL version:', result.rows[0].pg_version);
            
            // Check if tables exist
            const tablesResult = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            `);
            
            console.log('📋 Existing tables:', tablesResult.rows.map(row => row.table_name));
            
            await client.end();
            console.log('🎉 Database is awake and responsive!');
            return true;
            
        } catch (error) {
            console.log(`❌ Attempt ${attempts} failed:`, error.message);
            
            try {
                await client.end();
            } catch (endError) {
                // Ignore errors when ending client
            }
            
            if (attempts < maxAttempts) {
                console.log(`⏳ Waiting 5 seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    
    console.log('💔 Failed to wake up database after all attempts');
    return false;
}

if (require.main === module) {
    wakeUpDatabase()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { wakeUpDatabase };