const path = require('path');
const fs = require('fs');

module.exports = async () => {
  console.log('🧹 Pulizia ambiente di test...');
  
  // Rimuovi database di test
  const testDbPath = path.join(__dirname, '..', 'test_database.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
    console.log('🗑️ Database di test rimosso');
  }
  
  console.log('✅ Pulizia completata');
};