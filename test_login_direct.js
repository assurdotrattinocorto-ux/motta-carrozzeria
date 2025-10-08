const fetch = require('node-fetch');

async function testLogin() {
  console.log('=== TEST LOGIN API ===\n');
  
  const baseUrl = 'http://localhost:5000';
  
  // Test 1: Login Admin
  console.log('🔐 TEST LOGIN ADMIN');
  try {
    const adminResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@motta.it',
        password: 'admin123'
      })
    });
    
    const adminData = await adminResponse.json();
    console.log(`Status: ${adminResponse.status}`);
    
    if (adminResponse.ok) {
      console.log('✅ LOGIN ADMIN RIUSCITO!');
      console.log(`   Token: ${adminData.token ? 'Presente' : 'Mancante'}`);
      console.log(`   User ID: ${adminData.user.id}`);
      console.log(`   Nome: ${adminData.user.name}`);
      console.log(`   Email: ${adminData.user.email}`);
      console.log(`   Ruolo: ${adminData.user.role}`);
    } else {
      console.log('❌ LOGIN ADMIN FALLITO!');
      console.log(`   Errore: ${adminData.error}`);
    }
  } catch (error) {
    console.log('❌ ERRORE NELLA CHIAMATA ADMIN:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Login Dipendente
  console.log('🔐 TEST LOGIN DIPENDENTE');
  try {
    const empResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'dipendente@motta.it',
        password: 'dipendente123'
      })
    });
    
    const empData = await empResponse.json();
    console.log(`Status: ${empResponse.status}`);
    
    if (empResponse.ok) {
      console.log('✅ LOGIN DIPENDENTE RIUSCITO!');
      console.log(`   Token: ${empData.token ? 'Presente' : 'Mancante'}`);
      console.log(`   User ID: ${empData.user.id}`);
      console.log(`   Nome: ${empData.user.name}`);
      console.log(`   Email: ${empData.user.email}`);
      console.log(`   Ruolo: ${empData.user.role}`);
    } else {
      console.log('❌ LOGIN DIPENDENTE FALLITO!');
      console.log(`   Errore: ${empData.error}`);
    }
  } catch (error) {
    console.log('❌ ERRORE NELLA CHIAMATA DIPENDENTE:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Login con credenziali sbagliate
  console.log('🔐 TEST LOGIN CON CREDENZIALI SBAGLIATE');
  try {
    const wrongResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@motta.it',
        password: 'passwordsbagliata'
      })
    });
    
    const wrongData = await wrongResponse.json();
    console.log(`Status: ${wrongResponse.status}`);
    
    if (!wrongResponse.ok) {
      console.log('✅ RIFIUTO CREDENZIALI SBAGLIATE CORRETTO!');
      console.log(`   Errore: ${wrongData.error}`);
    } else {
      console.log('❌ PROBLEMA: Ha accettato credenziali sbagliate!');
    }
  } catch (error) {
    console.log('❌ ERRORE NELLA CHIAMATA:', error.message);
  }
  
  console.log('\n=== RIEPILOGO ===');
  console.log('Se i login admin e dipendente sono riusciti, il problema è nel frontend.');
  console.log('Se sono falliti, il problema è nel backend o nel database.');
}

testLogin();