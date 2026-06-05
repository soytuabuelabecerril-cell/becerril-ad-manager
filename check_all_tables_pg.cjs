// check_all_tables_pg.cjs
const { Client } = require('pg');

const regions = [
  'eu-central-1', 'eu-west-3', 'eu-west-1', 'eu-west-2', 'eu-north-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1', 'ap-southeast-1', 'ap-southeast-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-south-1', 'sa-east-1'
];

async function tryRegion(region) {
  const client = new Client({
    user: 'postgres.dfjxmnsozvmfhojnuikx',
    password: 'pBX5dYZR6XcYvJ1EHvzA',
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    await client.connect();
    return client;
  } catch (err) {
    try { await client.end(); } catch (e) {}
    return null;
  }
}

async function run() {
  let client = null;
  for (const region of regions) {
    client = await tryRegion(region);
    if (client) {
      console.log(`Connected via region: ${region}`);
      break;
    }
  }

  if (!client) {
    console.error('Could not connect to any region!');
    process.exit(1);
  }

  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    
    console.log("Tables in public schema:");
    res.rows.forEach(r => console.log(`  - ${r.table_name}`));
  } catch (err) {
    console.error('Query failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
