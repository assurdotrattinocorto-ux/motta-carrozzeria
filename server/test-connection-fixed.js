const { Client } = require('pg');
require('dotenv').config({ path: './.env' });

console.log('Environment variables loaded:');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

async function testConnection() {
    console.log('Testing PostgreSQL connection with improved SSL configuration...');
    
    // Parse the DATABASE_URL to extract components
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
        console.error('❌ DATABASE_URL not found in environment variables');
        return;
    }
    
    console.log('Database URL (without password):', databaseUrl.replace(/:[^:@]*@/, ':***@'));
    
    const client = new Client({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false, // For Render's free tier
            require: true
        },
        connectionTimeoutMillis: 30000,
        query_timeout: 30000,
        statement_timeout: 30000,
        idle_in_transaction_session_timeout: 30000,
        application_name: 'motta-test-connection-fixed'
    });

    try {
        console.log('Attempting to connect...');
        await client.connect();
        console.log('✅ Connected successfully!');
        
        // Test basic query
        console.log('Testing basic query...');
        const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ Query successful!');
        console.log('Current time:', result.rows[0].current_time);
        console.log('PostgreSQL version:', result.rows[0].pg_version);
        
        // Check if tables exist
        console.log('\nChecking existing tables...');
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        
        if (tablesResult.rows.length > 0) {
            console.log('✅ Existing tables:');
            tablesResult.rows.forEach(row => {
                console.log(`  - ${row.table_name}`);
            });
        } else {
            console.log('ℹ️  No tables found in the database');
        }
        
        // Test creating a simple table
        console.log('\nTesting table creation...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS test_connection (
                id SERIAL PRIMARY KEY,
                test_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Test table created successfully');
        
        // Insert test data
        await client.query(`
            INSERT INTO test_connection (test_message) 
            VALUES ('Connection test successful at ' || NOW())
        `);
        console.log('✅ Test data inserted successfully');
        
        // Query test data
        const testResult = await client.query('SELECT * FROM test_connection ORDER BY created_at DESC LIMIT 1');
        console.log('✅ Test data retrieved:', testResult.rows[0]);
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Error code:', error.code);
        console.error('Error details:', error);
    } finally {
        try {
            await client.end();
            console.log('Connection closed');
        } catch (closeError) {
            console.error('Error closing connection:', closeError.message);
        }
    }
}

testConnection();