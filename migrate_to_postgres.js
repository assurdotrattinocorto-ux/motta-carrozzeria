const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');

// Carica le variabili d'ambiente dal file .env
require('dotenv').config();

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

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS spare_parts (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        part_number VARCHAR(255),
        supplier VARCHAR(255),
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        quote_number VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        labor_hours DECIMAL(10,2) DEFAULT 0,
        labor_rate DECIMAL(10,2) DEFAULT 0,
        labor_total DECIMAL(10,2) DEFAULT 0,
        parts_total DECIMAL(10,2) DEFAULT 0,
        subtotal DECIMAL(10,2) DEFAULT 0,
        tax_rate DECIMAL(5,4) DEFAULT 0.22,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP,
        approved_at TIMESTAMP,
        rejected_at TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS quote_items (
        id SERIAL PRIMARY KEY,
        quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        invoice_number VARCHAR(255) UNIQUE NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        labor_hours DECIMAL(10,2) DEFAULT 0,
        labor_rate DECIMAL(10,2) DEFAULT 0,
        labor_total DECIMAL(10,2) DEFAULT 0,
        parts_total DECIMAL(10,2) DEFAULT 0,
        subtotal DECIMAL(10,2) DEFAULT 0,
        tax_rate DECIMAL(5,4) DEFAULT 0.22,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        payment_method VARCHAR(100) DEFAULT 'bank_transfer',
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP,
        paid_at TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    // Migrazione spare_parts (se esistono)
    const spareParts = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM spare_parts', (err, rows) => {
        if (err && !err.message.includes('no such table')) reject(err);
        else resolve(rows || []);
      });
    });

    for (const sparePart of spareParts) {
      await pgClient.query(
        `INSERT INTO spare_parts (id, job_id, name, part_number, supplier, quantity, unit_price, total_price, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
        [sparePart.id, sparePart.job_id, sparePart.name, sparePart.part_number, sparePart.supplier,
         sparePart.quantity, sparePart.unit_price, sparePart.total_price, sparePart.created_at, sparePart.updated_at]
      );
    }
    console.log(`✅ Migrati ${spareParts.length} ricambi`);

    // Migrazione quotes (se esistono)
    const quotes = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM quotes', (err, rows) => {
        if (err && !err.message.includes('no such table')) reject(err);
        else resolve(rows || []);
      });
    });

    for (const quote of quotes) {
      await pgClient.query(
        `INSERT INTO quotes (id, job_id, quote_number, status, labor_hours, labor_rate, labor_total, 
         parts_total, subtotal, tax_rate, tax_amount, total_amount, notes, created_by, created_at, 
         updated_at, sent_at, approved_at, rejected_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) ON CONFLICT DO NOTHING`,
        [quote.id, quote.job_id, quote.quote_number, quote.status, quote.labor_hours, quote.labor_rate,
         quote.labor_total, quote.parts_total, quote.subtotal, quote.tax_rate, quote.tax_amount,
         quote.total_amount, quote.notes, quote.created_by, quote.created_at, quote.updated_at,
         quote.sent_at, quote.approved_at, quote.rejected_at]
      );
    }
    console.log(`✅ Migrati ${quotes.length} preventivi`);

    // Migrazione quote_items (se esistono)
    const quoteItems = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM quote_items', (err, rows) => {
        if (err && !err.message.includes('no such table')) reject(err);
        else resolve(rows || []);
      });
    });

    for (const quoteItem of quoteItems) {
      await pgClient.query(
        `INSERT INTO quote_items (id, quote_id, type, description, quantity, unit_price, total_price, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [quoteItem.id, quoteItem.quote_id, quoteItem.type, quoteItem.description, quoteItem.quantity,
         quoteItem.unit_price, quoteItem.total_price, quoteItem.created_at]
      );
    }
    console.log(`✅ Migrati ${quoteItems.length} elementi preventivi`);

    // Migrazione invoices (se esistono)
    const invoices = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM invoices', (err, rows) => {
        if (err && !err.message.includes('no such table')) reject(err);
        else resolve(rows || []);
      });
    });

    for (const invoice of invoices) {
      await pgClient.query(
        `INSERT INTO invoices (id, quote_id, job_id, invoice_number, invoice_date, due_date, status, 
         labor_hours, labor_rate, labor_total, parts_total, subtotal, tax_rate, tax_amount, 
         total_amount, notes, payment_method, created_by, created_at, updated_at, sent_at, paid_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) ON CONFLICT DO NOTHING`,
        [invoice.id, invoice.quote_id, invoice.job_id, invoice.invoice_number, invoice.invoice_date,
         invoice.due_date, invoice.status, invoice.labor_hours, invoice.labor_rate, invoice.labor_total,
         invoice.parts_total, invoice.subtotal, invoice.tax_rate, invoice.tax_amount, invoice.total_amount,
         invoice.notes, invoice.payment_method, invoice.created_by, invoice.created_at, invoice.updated_at,
         invoice.sent_at, invoice.paid_at]
      );
    }
    console.log(`✅ Migrati ${invoices.length} fatture`);

    // Migrazione invoice_items (se esistono)
    const invoiceItems = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM invoice_items', (err, rows) => {
        if (err && !err.message.includes('no such table')) reject(err);
        else resolve(rows || []);
      });
    });

    for (const invoiceItem of invoiceItems) {
      await pgClient.query(
        `INSERT INTO invoice_items (id, invoice_id, type, description, quantity, unit_price, total_price, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [invoiceItem.id, invoiceItem.invoice_id, invoiceItem.type, invoiceItem.description, invoiceItem.quantity,
         invoiceItem.unit_price, invoiceItem.total_price, invoiceItem.created_at]
      );
    }
    console.log(`✅ Migrati ${invoiceItems.length} elementi fatture`);

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