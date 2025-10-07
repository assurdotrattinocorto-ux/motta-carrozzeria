const fetch = require('node-fetch');

async function testAdminAPI() {
  try {
    console.log('Testing Admin API...');
    
    // Login come admin
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

    if (!loginResponse.ok) {
      console.error('Login failed:', loginResponse.status, await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    console.log('Login successful as admin:', loginData.user.name);
    
    const token = loginData.token;

    // Fetch jobs come admin
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
    console.log(`Admin sees ${jobs.length} jobs:`);
    jobs.forEach((job, index) => {
      console.log(`${index + 1}. ${job.title} - ${job.customer_name} (Status: ${job.status})`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

testAdminAPI();