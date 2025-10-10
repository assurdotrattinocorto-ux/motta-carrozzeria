const { Client } = require('pg');

async function testDirectConnection() {
    console.log('🔍 Testing direct PostgreSQL connection...');
    
    const connectionString = 'postgresql://motta_carrozzeria_database_user:L1Y3a71NAjCxYwCcfzeE87TbYMFxLuG7@dpg-d3kiqcp5pdvs739j3j40-a.oregon-postgres.render.com:5432/motta_carrozzeria_database?sslmode=require';
    
    const client = new Client({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false
        },
        connectionTimeoutMillis: 30000,
        query_timeout: 30000
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected successfully!');
        
        console.log('🔍 Testing simple query...');
        const result = await client.query('SELECT NOW() as current_time');
        console.log('✅ Query successful:', result.rows[0]);
        
        console.log('📋 Listing existing tables...');
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('📊 Tables found:', tables.rows.map(row => row.table_name));
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Error code:', error.code);
        console.error('Error details:', error);
    } finally {
        try {
            await client.end();
            console.log('🔌 Connection closed');
        } catch (err) {
            console.error('Error closing connection:', err.message);
        }
    }
}

testDirectConnection();