const fetch = require('node-fetch');

async function testEmployeeAPI() {
  try {
    console.log('Testing Employee API...');
    
    // Login come dipendente
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'dipendente@motta.it',
        password: 'dipendente123'
      })
    });

    if (!loginResponse.ok) {
      console.error('Login failed:', loginResponse.status, await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    console.log('Login successful as employee:', loginData.user.name);
    
    const token = loginData.token;

    // Fetch jobs come dipendente
    const jobsResponse = await fetch('http://localhost:5000/api/jobs', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!jobsResponse.ok) {
      console.error('Jobs fetch failed:', jobsResponse.status, await jobsResponse.text());
      return;
    }

    const jobs = await jobsResponse.json();
    console.log(`Employee sees ${jobs.length} jobs:`);
    jobs.forEach((job, index) => {
      console.log(`${index + 1}. ${job.title} - ${job.customer_name} (Status: ${job.status})`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

testEmployeeAPI();