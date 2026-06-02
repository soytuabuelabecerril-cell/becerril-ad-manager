// test_pooler_ip.cjs
const { Client } = require('pg');

const client = new Client({
  user: 'postgres.dfjxmnsozvmfhojnuikx',
  password: 'pBX5dYZR6XcYvJ1EHvzA',
  host: '18.198.30.239', // aws-0-eu-central-1.pooler.supabase.com IPv4
  port: 5432,
  database: 'postgres',
  ssl: { rejectUnauthorized: false, servername: 'aws-0-eu-central-1.pooler.supabase.com' }
});

async function run() {
  try {
    console.log('Connecting to pooler IPv4 directly...');
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
