const fetch = require('node-fetch');

async function testEmployeesAPI() {
  console.log('=== TEST API DIPENDENTI ===\n');
  
  const baseUrl = 'http://localhost:5000';
  
  // Test 1: GET /api/employees
  console.log('📋 TEST GET /api/employees');
  try {
    const response = await fetch(`${baseUrl}/api/employees`);
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      console.log(`✅ API FUNZIONA - Trovati ${data.length} dipendenti:`);
      data.forEach((emp, index) => {
        console.log(`   ${index + 1}. ID: ${emp.id} - Nome: ${emp.name} - Email: ${emp.email}`);
      });
    } else {
      console.log('❌ ERRORE API:', data.error || data.message);
    }
  } catch (error) {
    console.log('❌ ERRORE NELLA CHIAMATA:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Controllare direttamente il database
  console.log('🗄️ CONTROLLO DIRETTO DATABASE');
  
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database('./database.db');
  
  return new Promise((resolve) => {
    db.all('SELECT * FROM employees', (err, rows) => {
      if (err) {
        console.log('❌ ERRORE DATABASE:', err.message);
      } else {
        console.log(`📊 DIPENDENTI NEL DATABASE: ${rows.length}`);
        rows.forEach((emp, index) => {
          console.log(`   ${index + 1}. ID: ${emp.id} - Nome: ${emp.name} - Email: ${emp.email}`);
        });
      }
      
      db.close();
      
      console.log('\n=== RIEPILOGO ===');
      console.log('Se l\'API restituisce dipendenti ma il database è vuoto, c\'è un problema nel server.');
      console.log('Se entrambi sono vuoti ma il frontend li mostra, il problema è nel cache/frontend.');
      
      resolve();
    });
  });
}

testEmployeesAPI();