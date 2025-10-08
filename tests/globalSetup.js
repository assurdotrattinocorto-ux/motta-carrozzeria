const path = require('path');
const fs = require('fs');

module.exports = async () => {
  console.log('🧪 Inizializzazione ambiente di test...');
  
  // Assicurati che la directory di test esista
  const testDir = path.join(__dirname);
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Imposta variabili di ambiente per i test
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_key';
  process.env.DATABASE_PATH = path.join(__dirname, '..', 'test_database.db');
  
  console.log('✅ Ambiente di test inizializzato');
};