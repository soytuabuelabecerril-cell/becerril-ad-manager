const { Client } = require('pg');

const regions = [
  'eu-central-1', 'eu-west-3', 'eu-west-1', 'eu-west-2', 'eu-north-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1', 'ap-southeast-1', 'ap-southeast-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-south-1', 'sa-east-1'
];

async function tryRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new Client({
    user: 'postgres.dfjxmnsozvmfhojnuikx',
    password: 'pBX5dYZR6XcYvJ1EHvzA',
    host: host,
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000
  });

  try {
    await client.connect();
    console.log(`SUCCESS: Connected to ${region}`);
    return true;
  } catch (err) {
    console.log(`Region ${region}: ${err.message}`);
    return false;
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

async function run() {
  console.log("Checking all regions on port 6543...");
  for (const r of regions) {
    const ok = await tryRegion(r);
    if (ok) break;
  }
  console.log("Done.");
}

run();
