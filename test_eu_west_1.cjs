// test_eu_west_1.cjs
const { Client } = require('pg');

const client = new Client({
  user: 'postgres.dfjxmnsozvmfhojnuikx',
  password: 'pBX5dYZR6XcYvJ1EHvzA',
  host: '34.241.16.247', // aws-0-eu-west-1.pooler.supabase.com IPv4
  port: 6543,
  database: 'postgres',
  ssl: { rejectUnauthorized: false, servername: 'aws-0-eu-west-1.pooler.supabase.com' }
});

async function run() {
  try {
    console.log('Connecting to eu-west-1 pooler IPv4...');
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query('SELECT current_database();');
    console.log('Query result:', res.rows);
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
