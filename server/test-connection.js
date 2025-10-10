const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

async function testConnection() {
    console.log('🔍 Testing PostgreSQL connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        },
        connectionTimeoutMillis: 60000, // 60 secondi
        query_timeout: 60000,
        statement_timeout: 60000,
        idle_in_transaction_session_timeout: 60000,
        application_name: 'motta-test-connection'
    });

    try {
        console.log('⏳ Attempting to connect...');
        await client.connect();
        console.log('✅ Connection successful!');
        
        // Test a simple query
        const result = await client.query('SELECT version()');
        console.log('📊 PostgreSQL version:', result.rows[0].version);
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Error code:', error.code);
        console.error('Full error:', error);
        
        if (error.message.includes('password authentication failed')) {
            console.log('🔑 The password in the DATABASE_URL is incorrect or a placeholder');
        }
        
    } finally {
        await client.end();
    }
}

testConnection();