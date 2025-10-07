const fetch = require('node-fetch');

async function debugLogin() {
  try {
    console.log('=== DEBUG LOGIN ADMIN ===');
    
    // Prova login admin
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@motta.it',
        password: 'admin123'
      })
    });

    console.log('Status:', loginResponse.status);
    console.log('Headers:', loginResponse.headers.raw());
    
    const responseText = await loginResponse.text();
    console.log('Response body:', responseText);
    
    if (loginResponse.ok) {
      const loginData = JSON.parse(responseText);
      console.log('Login data:', loginData);
      
      if (loginData.user) {
        console.log('User ID:', loginData.user.id);
        console.log('User name:', loginData.user.name);
        console.log('User role:', loginData.user.role);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

debugLogin();