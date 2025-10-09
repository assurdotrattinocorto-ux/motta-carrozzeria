const { Client } = require('pg');
require('dotenv').config();

async function wakeUpRenderDatabase() {
  console.log('🌅 Tentativo di risveglio database Render...\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL non trovato nel file .env');
    process.exit(1);
  }

  // Configurazione con timeout più lunghi per database in sleep
  const config = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 120000, // 2 minuti
    idleTimeoutMillis: 120000,
    query_timeout: 120000,
    statement_timeout: 120000
  };

  let attempts = 5;
  let connected = false;
  
  console.log('📋 Configurazione database:');
  console.log(`   Host: ${process.env.DATABASE_URL.split('@')[1].split('/')[0]}`);
  console.log(`   Database: ${process.env.DATABASE_URL.split('/').pop()}`);
  console.log(`   SSL: Abilitato\n`);
  
  for (let i = 1; i <= attempts && !connected; i++) {
    const client = new Client(config);
    
    try {
      console.log(`🔄 Tentativo ${i}/${attempts} - Connessione in corso...`);
      console.log('   ⏳ Attendo risposta dal database (timeout: 2 minuti)...');
      
      await client.connect();
      console.log('✅ Connessione stabilita!');
      
      // Query semplice per verificare che il database sia attivo
      console.log('🔍 Test funzionalità database...');
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      
      console.log('📊 Informazioni database:');
      console.log(`   Ora corrente: ${result.rows[0].current_time}`);
      console.log(`   Versione PostgreSQL: ${result.rows[0].pg_version.split(' ')[0]}`);
      
      // Controlla le tabelle esistenti
      const tables = await client.query(`
        SELECT table_name, 
               (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      console.log('\n📋 Stato database:');
      if (tables.rows.length === 0) {
        console.log('   ⚠️  Database vuoto - nessuna tabella trovata');
        console.log('   💡 Sarà necessario eseguire le migrazioni');
      } else {
        console.log(`   ✅ Trovate ${tables.rows.length} tabelle:`);
        tables.rows.forEach(row => {
          console.log(`      - ${row.table_name} (${row.column_count} colonne)`);
        });
      }
      
      await client.end();
      connected = true;
      console.log('\n🎉 Database Render è ora attivo e pronto!');
      
    } catch (error) {
      console.error(`❌ Tentativo ${i} fallito:`, error.message);
      
      try {
        await client.end();
      } catch (endError) {
        // Ignora errori di chiusura
      }
      
      if (i < attempts) {
        const waitTime = Math.min(30 + (i * 10), 60); // Aumenta il tempo di attesa
        console.log(`⏳ Attendo ${waitTime} secondi prima del prossimo tentativo...\n`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }
  }
  
  if (!connected) {
    console.log('\n💡 Il database potrebbe richiedere più tempo per attivarsi.');
    console.log('   Suggerimenti:');
    console.log('   1. Accedi manualmente al dashboard Render');
    console.log('   2. Controlla lo stato del database');
    console.log('   3. Riprova tra qualche minuto');
    process.exit(1);
  }
}

wakeUpRenderDatabase();