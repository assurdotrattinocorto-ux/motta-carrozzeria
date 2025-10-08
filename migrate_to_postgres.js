const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');

// Configurazione database
const sqliteDbPath = path.join(__dirname, 'database.db');

// Usa la stessa configurazione del server
const postgresConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
} : null;

if (!postgresConfig) {
  console.error('❌ DATABASE_URL non trovato nelle variabili ambiente');
  console.log('Assicurati di aver configurato DATABASE_URL nel file .env');
  process.exit(1);
}

async function migrateToPostgres() {
  console.log('🚀 Inizio migrazione da SQLite a PostgreSQL...\n');

  // Connessione a SQLite
  const sqliteDb = new sqlite3.Database(sqliteDbPath);
  
  // Connessione a PostgreSQL con timeout e retry
  const pgClient = new Client({
    ...postgresConfig,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    query_timeout: 30000
  });
  
  try {
    console.log('🔗 Tentativo di connessione a PostgreSQL...');
    await pgClient.connect();
    console.log('✅ Connesso a PostgreSQL');
    
    // Test della connessione
    const result = await pgClient.query('SELECT version()');
    console.log('📊 Versione PostgreSQL:', result.rows[0].version.split(' ')[0]);
  } catch (error) {
    console.error('❌ Errore di connessione PostgreSQL:', error.message);
    console.log('💡 Il database gratuito di Render potrebbe essere in sleep mode.');
    console.log('💡 Prova ad accedere al dashboard Render per risvegliarlo.');
    process.exit(1);
  }

  try {
    // 1. Creare le tabelle in PostgreSQL
    console.log('📋 Creazione tabelle PostgreSQL...');
    
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        customer_id INTEGER REFERENCES customers(id),
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(50) DEFAULT 'medium',
        estimated_hours INTEGER,
        actual_hours INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_date TIMESTAMP,
        notes TEXT
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        position VARCHAR(255),
        hourly_rate DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS job_assignments (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(job_id, employee_id)
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS archived_jobs (
        id SERIAL PRIMARY KEY,
        original_job_id INTEGER,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        status VARCHAR(50),
        priority VARCHAR(50),
        estimated_hours INTEGER,
        actual_hours INTEGER,
        created_by INTEGER,
        created_by_name VARCHAR(255),
        created_at TIMESTAMP,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_date TIMESTAMP,
        notes TEXT,
        assigned_employees TEXT
      )
    `);

    console.log('✅ Tabelle create con successo');

    // 2. Migrare i dati
    console.log('📦 Migrazione dati...');

    // Migrazione users
    const users = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM users', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    for (const user of users) {
      await pgClient.query(
        'INSERT INTO users (id, email, password, name, role, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING',
        [user.id, user.email, user.password, user.name, user.role, user.created_at]
      );
    }
    console.log(`✅ Migrati ${users.length} utenti`);

    // Migrazione customers
    const customers = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM customers', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    for (const customer of customers) {
      await pgClient.query(
        'INSERT INTO customers (id, name, email, phone, address, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
        [customer.id, customer.name, customer.email, customer.phone, customer.address, customer.created_at]
      );
    }
    console.log(`✅ Migrati ${customers.length} clienti`);

    // Migrazione jobs
    const jobs = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM jobs', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    for (const job of jobs) {
      await pgClient.query(
        `INSERT INTO jobs (id, title, description, customer_id, customer_name, customer_phone, 
         status, priority, estimated_hours, actual_hours, created_by, created_at, updated_at, due_date, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT DO NOTHING`,
        [job.id, job.title, job.description, job.customer_id, job.customer_name, job.customer_phone,
         job.status, job.priority, job.estimated_hours, job.actual_hours, job.created_by, 
         job.created_at, job.updated_at, job.due_date, job.notes]
      );
    }
    console.log(`✅ Migrati ${jobs.length} lavori`);

    // Migrazione employees (se esistono)
    const employees = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM employees', (err, rows) => {
        if (err && !err.message.includes('no such table')) reject(err);
        else resolve(rows || []);
      });
    });

    for (const employee of employees) {
      await pgClient.query(
        'INSERT INTO employees (id, name, email, phone, position, hourly_rate, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (email) DO NOTHING',
        [employee.id, employee.name, employee.email, employee.phone, employee.position, employee.hourly_rate, employee.created_at]
      );
    }
    console.log(`✅ Migrati ${employees.length} dipendenti`);

    // Migrazione job_assignments (se esistono)
    const assignments = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM job_assignments', (err, rows) => {
        if (err && !err.message.includes('no such table')) reject(err);
        else resolve(rows || []);
      });
    });

    for (const assignment of assignments) {
      await pgClient.query(
        'INSERT INTO job_assignments (id, job_id, employee_id, assigned_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [assignment.id, assignment.job_id, assignment.employee_id, assignment.assigned_at]
      );
    }
    console.log(`✅ Migrati ${assignments.length} assegnamenti`);

    // Migrazione archived_jobs (se esistono)
    const archivedJobs = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM archived_jobs', (err, rows) => {
        if (err && !err.message.includes('no such table')) reject(err);
        else resolve(rows || []);
      });
    });

    for (const archivedJob of archivedJobs) {
      await pgClient.query(
        `INSERT INTO archived_jobs (id, original_job_id, title, description, customer_name, customer_phone,
         status, priority, estimated_hours, actual_hours, created_by, created_by_name, created_at, 
         completed_at, due_date, notes, assigned_employees) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) ON CONFLICT DO NOTHING`,
        [archivedJob.id, archivedJob.original_job_id, archivedJob.title, archivedJob.description,
         archivedJob.customer_name, archivedJob.customer_phone, archivedJob.status, archivedJob.priority,
         archivedJob.estimated_hours, archivedJob.actual_hours, archivedJob.created_by, archivedJob.created_by_name,
         archivedJob.created_at, archivedJob.completed_at, archivedJob.due_date, archivedJob.notes, archivedJob.assigned_employees]
      );
    }
    console.log(`✅ Migrati ${archivedJobs.length} lavori archiviati`);

    // Aggiornare le sequenze PostgreSQL
    console.log('🔄 Aggiornamento sequenze...');
    
    if (users.length > 0) {
      const maxUserId = Math.max(...users.map(u => u.id));
      await pgClient.query(`SELECT setval('users_id_seq', ${maxUserId})`);
    }
    
    if (customers.length > 0) {
      const maxCustomerId = Math.max(...customers.map(c => c.id));
      await pgClient.query(`SELECT setval('customers_id_seq', ${maxCustomerId})`);
    }
    
    if (jobs.length > 0) {
      const maxJobId = Math.max(...jobs.map(j => j.id));
      await pgClient.query(`SELECT setval('jobs_id_seq', ${maxJobId})`);
    }

    console.log('✅ Sequenze aggiornate');

    console.log('\n🎉 Migrazione completata con successo!');
    console.log('📊 Riepilogo:');
    console.log(`   - ${users.length} utenti`);
    console.log(`   - ${customers.length} clienti`);
    console.log(`   - ${jobs.length} lavori`);
    console.log(`   - ${employees.length} dipendenti`);
    console.log(`   - ${assignments.length} assegnamenti`);
    console.log(`   - ${archivedJobs.length} lavori archiviati`);

  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

// Esegui la migrazione se lo script viene chiamato direttamente
if (require.main === module) {
  migrateToPostgres().catch(console.error);
}

module.exports = { migrateToPostgres };