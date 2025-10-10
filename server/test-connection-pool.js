const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function testConnectionPool() {
    console.log('Testing PostgreSQL connection with Pool for Render compatibility...');
    
    const databaseUrl = process.env.DATABASE_URL;
    console.log('Database URL (without password):', databaseUrl.replace(/:[^:@]*@/, ':***@'));
    
    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false
        },
        max: 1, // Render free tier has connection limits
        idleTimeoutMillis: 0, // Disable idle timeout
        connectionTimeoutMillis: 60000,
        acquireTimeoutMillis: 60000,
        application_name: 'motta-pool-test'
    });

    let client;
    try {
        console.log('Acquiring client from pool...');
        client = await pool.connect();
        console.log('✅ Client acquired successfully!');
        
        // Test basic query
        console.log('Testing basic query...');
        const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ Query successful!');
        console.log('Current time:', result.rows[0].current_time);
        console.log('PostgreSQL version:', result.rows[0].pg_version);
        
        // Check database size and connection info
        console.log('\nChecking database info...');
        const dbInfo = await client.query(`
            SELECT 
                current_database() as database_name,
                current_user as user_name,
                inet_server_addr() as server_ip,
                inet_server_port() as server_port,
                pg_backend_pid() as backend_pid
        `);
        console.log('Database info:', dbInfo.rows[0]);
        
        // Check if tables exist
        console.log('\nChecking existing tables...');
        const tablesResult = await client.query(`
            SELECT table_name, table_type
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        
        if (tablesResult.rows.length > 0) {
            console.log('✅ Existing tables:');
            tablesResult.rows.forEach(row => {
                console.log(`  - ${row.table_name} (${row.table_type})`);
            });
        } else {
            console.log('ℹ️  No tables found in the database');
        }
        
        // Test creating the main tables for the application
        console.log('\nCreating application tables...');
        
        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table created');
        
        // Create appointments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS appointments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                service_type VARCHAR(255) NOT NULL,
                appointment_date DATE NOT NULL,
                appointment_time TIME NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Appointments table created');
        
        // Create services table
        await client.query(`
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10,2),
                duration_minutes INTEGER,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Services table created');
        
        // Insert sample data
        console.log('\nInserting sample data...');
        
        // Insert sample services
        await client.query(`
            INSERT INTO services (name, description, price, duration_minutes) 
            VALUES 
                ('Tagliando Auto', 'Manutenzione ordinaria completa', 150.00, 120),
                ('Cambio Olio', 'Sostituzione olio motore e filtri', 80.00, 60),
                ('Revisione Freni', 'Controllo e manutenzione sistema frenante', 120.00, 90)
            ON CONFLICT DO NOTHING
        `);
        
        // Insert sample user
        await client.query(`
            INSERT INTO users (name, email, phone) 
            VALUES ('Mario Rossi', 'mario.rossi@email.com', '+39 123 456 7890')
            ON CONFLICT (email) DO NOTHING
        `);
        
        console.log('✅ Sample data inserted');
        
        // Verify data
        const serviceCount = await client.query('SELECT COUNT(*) FROM services');
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        
        console.log(`\n📊 Database summary:`);
        console.log(`  - Services: ${serviceCount.rows[0].count}`);
        console.log(`  - Users: ${userCount.rows[0].count}`);
        
        console.log('\n🎉 Database setup completed successfully!');
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Error code:', error.code);
        console.error('Error stack:', error.stack);
    } finally {
        if (client) {
            client.release();
            console.log('Client released back to pool');
        }
        await pool.end();
        console.log('Pool closed');
    }
}

testConnectionPool();