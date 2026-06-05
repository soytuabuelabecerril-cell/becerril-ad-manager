const { Client } = require('pg');

const sql = `
-- 1. Add missing columns to public.orders if not exists
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS email_reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_reminders_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS whatsapp_reminders_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_auto_reminder_day INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS prolonged_count INT DEFAULT 0;

-- 2. Add missing columns to public.ad_reservations if not exists
ALTER TABLE public.ad_reservations 
ADD COLUMN IF NOT EXISTS email_reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_reminders_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS whatsapp_reminders_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_auto_reminder_day INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS prolonged_count INT DEFAULT 0;
`;

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
    console.log(`Connected via region: ${region}`);
    return client;
  } catch (err) {
    try { await client.end(); } catch (e) {}
    return null;
  }
}

async function run() {
  let client = null;

  for (const region of regions) {
    process.stdout.write(`Trying ${region}... `);
    client = await tryRegion(region);
    if (client) { console.log('OK'); break; }
    console.log('failed');
  }

  if (!client) {
    console.error('Could not connect to any region!');
    process.exit(1);
  }

  try {
    console.log('\nRunning migration SQL to add missing columns...');
    await client.query(sql);
    console.log('✅ Columns added successfully!');
  } catch (err) {
    console.error('Error running SQL:', err.message);
  } finally {
    await client.end();
  }
}

run();
