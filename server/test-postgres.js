const { Client } = require('pg');

// Test con diverse configurazioni di host
const hosts = [
  'dpg-d3iaqlbipnbc73e19qkg-a-a.oregon-postgres.render.com',
  'dpg-d3iaqlbipnbc73e19qkg-a.oregon-postgres.render.com'
];

async function testConnection() {
  console.log('Testando connessioni PostgreSQL...');
  
  for (const host of hosts) {
    console.log(`\nTestando host: ${host}`);
    
    const client = new Client({
      user: 'motta5_database_user',
      database: 'motta5_database',
      host: host,
      port: 5432,
      ssl: { rejectUnauthorized: false },
      // Nota: password placeholder - deve essere sostituita
      password: 'PASSWORD_PLACEHOLDER'
    });
    
    try {
      await client.connect();
      console.log('✓ Connessione riuscita!');
      const result = await client.query('SELECT NOW()');
      console.log('✓ Query test riuscita:', result.rows[0]);
      await client.end();
      break;
    } catch (error) {
      console.log('✗ Errore connessione:', error.message);
      try { await client.end(); } catch {}
    }
  }
}

testConnection().catch(console.error);