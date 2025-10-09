const { Client } = require('pg');
require('dotenv').config();

async function testRenderConnection() {
  console.log('🔗 Test connessione database Render...\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL non trovato nel file .env');
    process.exit(1);
  }

  let retries = 3;
  
  while (retries > 0) {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 60000,
      idleTimeoutMillis: 60000,
      query_timeout: 60000
    });
    
    try {
      console.log(`🔄 Tentativo di connessione (${4 - retries}/3)...`);
      await client.connect();
      console.log('✅ Connessione riuscita!');
      
      // Test query per verificare la connessione
      const result = await client.query('SELECT version()');
      console.log('📊 PostgreSQL Version:', result.rows[0].version.split(' ')[0]);
      
      // Controlla le tabelle esistenti
      const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      console.log('\n📋 Tabelle esistenti nel database:');
      if (tables.rows.length === 0) {
        console.log('   Nessuna tabella trovata - database vuoto');
      } else {
        tables.rows.forEach(row => {
          console.log(`   - ${row.table_name}`);
        });
      }
      
      await client.end();
      console.log('\n✅ Test completato con successo!');
      return;
      
    } catch (error) {
      console.error(`❌ Errore tentativo ${4 - retries}:`, error.message);
      retries--;
      
      if (retries > 0) {
        console.log(`⏳ Attendo 10 secondi prima del prossimo tentativo...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        console.log('\n💡 Suggerimenti per risolvere il problema:');
        console.log('   1. Il database Render gratuito va in sleep mode dopo inattività');
        console.log('   2. Accedi al dashboard Render per risvegliarlo');
        console.log('   3. Verifica che DATABASE_URL sia corretto nel file .env');
        console.log('   4. Controlla che il database sia attivo su Render');
        process.exit(1);
      }
    }
  }
}

testRenderConnection();