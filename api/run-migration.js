// api/run-migration.js
import pkg from 'pg';
const { Client } = pkg;

const regions = [
  'eu-central-1', 'eu-west-3', 'eu-west-1', 'eu-west-2', 'eu-north-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1', 'ap-southeast-1', 'ap-southeast-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-south-1', 'sa-east-1'
];

async function tryPooler(num, region) {
  const host = `aws-${num}-${region}.pooler.supabase.com`;
  const client = new Client({
    user: 'postgres.dfjxmnsozvmfhojnuikx',
    password: 'pBX5dYZR6XcYvJ1EHvzA',
    host,
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 3500,
  });

  try {
    await client.connect();
    return { client, host, region, num };
  } catch (err) {
    try { await client.end(); } catch (e) {}
    return { error: err.message, host, region, num };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log("Probing 96 pooler combinations in parallel...");
  
  const promises = [];
  for (const region of regions) {
    for (let num = 0; num <= 5; num++) {
      promises.push(tryPooler(num, region));
    }
  }

  const results = await Promise.all(promises);
  const success = results.find(r => r.client);

  if (!success) {
    // Return all errors to diagnose
    const errors = results.map(r => ({ host: r.host, error: r.error }));
    return res.status(500).json({
      success: false,
      message: 'Could not connect to any pooler combination!',
      errors: errors.filter(e => !e.error.includes('ENOTFOUND') && !e.error.includes('ETIMEDOUT')) // filter out DNS/timeout noise
    });
  }

  const { client, host, region, num } = success;

  try {
    console.log(`Connected successfully to pooler: ${host}`);
    
    // Create the contact_name column in public.customers
    await client.query(`
      ALTER TABLE public.customers 
      ADD COLUMN IF NOT EXISTS contact_name TEXT;
    `);

    // Reload schema
    await client.query("NOTIFY pgrst, 'reload schema';");

    return res.status(200).json({ 
      success: true, 
      message: `Database migrated successfully via pooler host ${host}! Column contact_name created.` 
    });
  } catch (err) {
    console.error('Migration query failed:', err);
    return res.status(500).json({ error: 'Migration failed', details: err.message, host });
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}
