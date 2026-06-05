const { Client } = require('pg');

async function tryConnect(user, host, port) {
  const client = new Client({
    user: user,
    password: 'pBX5dYZR6XcYvJ1EHvzA',
    host: host,
    port: port,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log(`SUCCESS: user=${user}, host=${host}, port=${port}`);
    const res = await client.query('SELECT current_database();');
    console.log('Result:', res.rows);
    return true;
  } catch (err) {
    console.log(`FAILED: user=${user}, host=${host}, port=${port} - Error: ${err.message}`);
    return false;
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

async function run() {
  const hosts = ['aws-0-eu-west-2.pooler.supabase.com', 'db.dfjxmnsozvmfhojnuikx.supabase.co'];
  const users = ['postgres', 'postgres.dfjxmnsozvmfhojnuikx'];
  const ports = [5432, 6543];

  for (const host of hosts) {
    for (const user of users) {
      for (const port of ports) {
        await tryConnect(user, host, port);
      }
    }
  }
}

run();
