const { Client } = require('pg');

async function run() {
  const host = 'aws-0-eu-central-1.pooler.supabase.com';
  const user = 'postgres.dfjxmnsozvmfhojnuikx';
  const client = new Client({
    user: user,
    password: 'pBX5dYZR6XcYvJ1EHvzA',
    host: host,
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log(`Connecting to ${host} as ${user}...`);
    await client.connect();
    console.log('Successfully connected!');
    const res = await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\';');
    console.log('Tables:', res.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

run();
