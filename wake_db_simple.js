const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

client.connect()
    .then(() => {
        console.log('Connected!');
        return client.query('SELECT 1');
    })
    .then(() => {
        console.log('Query executed!');
    })
    .catch(console.error)
    .finally(() => client.end());