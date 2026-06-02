const { Client } = require('pg');

async function testRegion(region) {
  const client = new Client({
    user: 'postgres.dfjxmnsozvmfhojnuikx',
    password: 'pBX5dYZR6XcYvJ1EHvzA',
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`\n>>> FOUND THE REGION! Successfully connected in: ${region} <<<\n`);
    return true;
  } catch (err) {
    if (err.message && err.message.includes('tenant/user')) {
      // Wrong region, continue
      process.stdout.write('.');
    } else {
      // Some other error (e.g., auth, network)
      console.log(`\nRegion ${region} failed with:`, err.message);
    }
    return false;
  } finally {
    try {
      await client.end();
    } catch(e) {}
  }
}

async function run() {
  const regions = [
    'eu-central-1', 'eu-west-3', 'eu-west-1', 'eu-west-2', 'eu-north-1',
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'ca-central-1', 'ap-southeast-1', 'ap-southeast-2',
    'ap-northeast-1', 'ap-northeast-2', 'ap-south-1', 'sa-east-1'
  ];
  console.log("Checking regions...");
  for (const r of regions) {
    const ok = await testRegion(r);
    if (ok) break;
  }
  console.log("\nFinished check.");
}

run();
