const fetch = require('node-fetch');

async function testAPI() {
  try {
    // 1. Login come Mario Rossi
    console.log('=== LOGIN MARIO ROSSI ===');
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'mario.rossi@motta.com',
        password: 'mario123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (loginData.token) {
      // 2. Testa l'endpoint /api/jobs con il token di Mario
      console.log('\n=== TEST /api/jobs CON MARIO ROSSI ===');
      const jobsResponse = await fetch('http://localhost:5000/api/jobs', {
        headers: {
          'Authorization': `Bearer ${loginData.token}`
        }
      });
      
      const jobs = await jobsResponse.json();
      console.log('Status:', jobsResponse.status);
      console.log('Numero di lavori restituiti:', Array.isArray(jobs) ? jobs.length : 'Errore');
      
      if (Array.isArray(jobs)) {
        jobs.forEach(job => {
          console.log(`- ID: ${job.id} | "${job.title}" | Assegnato a: ${job.assigned_to_name}`);
        });
      } else {
        console.log('Errore:', jobs);
      }
    }
    
    // 3. Login come Admin
    console.log('\n=== LOGIN ADMIN ===');
    const adminLoginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@motta.com',
        password: 'admin123'
      })
    });
    
    const adminLoginData = await adminLoginResponse.json();
    console.log('Admin login response:', adminLoginData);
    
    if (adminLoginData.token) {
      // 4. Testa l'endpoint /api/jobs con il token dell'admin
      console.log('\n=== TEST /api/jobs CON ADMIN ===');
      const adminJobsResponse = await fetch('http://localhost:5000/api/jobs', {
        headers: {
          'Authorization': `Bearer ${adminLoginData.token}`
        }
      });
      
      const adminJobs = await adminJobsResponse.json();
      console.log('Status:', adminJobsResponse.status);
      console.log('Numero di lavori restituiti:', Array.isArray(adminJobs) ? adminJobs.length : 'Errore');
      
      if (Array.isArray(adminJobs)) {
        adminJobs.forEach(job => {
          console.log(`- ID: ${job.id} | "${job.title}" | Assegnato a: ${job.assigned_to_name}`);
        });
      } else {
        console.log('Errore:', adminJobs);
      }
    }
    
  } catch (error) {
    console.error('Errore:', error);
  }
}

testAPI();