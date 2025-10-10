const { Pool } = require('pg');

// Database initialization script for Motta Carrozzeria
async function initializeDatabase() {
    console.log('🚀 Initializing Motta Carrozzeria Database...');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 1, // Render free tier connection limit
        idleTimeoutMillis: 0,
        connectionTimeoutMillis: 60000
    });

    let client;
    try {
        client = await pool.connect();
        console.log('✅ Connected to PostgreSQL database');
        
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
        console.log('✅ Users table ready');
        
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
        console.log('✅ Services table ready');
        
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
        console.log('✅ Appointments table ready');
        
        // Insert default services if they don't exist
        const serviceCount = await client.query('SELECT COUNT(*) FROM services');
        if (parseInt(serviceCount.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO services (name, description, price, duration_minutes) 
                VALUES 
                    ('Tagliando Auto', 'Manutenzione ordinaria completa del veicolo', 150.00, 120),
                    ('Cambio Olio', 'Sostituzione olio motore e filtri', 80.00, 60),
                    ('Revisione Freni', 'Controllo e manutenzione sistema frenante', 120.00, 90),
                    ('Diagnosi Elettronica', 'Controllo centraline e sistemi elettronici', 60.00, 45),
                    ('Riparazione Carrozzeria', 'Riparazione danni alla carrozzeria', 200.00, 180)
            `);
            console.log('✅ Default services inserted');
        }
        
        // Verify setup
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('📊 Database tables:');
        tables.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
        
        const servicesCount = await client.query('SELECT COUNT(*) FROM services');
        console.log(`📋 Services available: ${servicesCount.rows[0].count}`);
        
        console.log('🎉 Database initialization completed successfully!');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        throw error;
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Export for use in other modules
module.exports = { initializeDatabase };

// Run if called directly
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('Database initialization script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Database initialization script failed:', error);
            process.exit(1);
        });
}