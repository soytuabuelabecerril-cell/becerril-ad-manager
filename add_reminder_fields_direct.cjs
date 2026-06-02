// add_reminder_fields_direct.cjs
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:pBX5dYZR6XcYvJ1EHvzA@db.dfjxmnsozvmfhojnuikx.supabase.co:5432/postgres';

const sql = `
-- Add reminder_sent_at to ad_reservations
ALTER TABLE public.ad_reservations 
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Add reminder_sent_at to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
`;

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to database directly.");

    console.log('Running migration SQL to add reminder_sent_at...');
    await client.query(sql);
    console.log('✅ Columns added successfully!');
  } catch (err) {
    console.error('Error running SQL:', err.message);
  } finally {
    await client.end();
  }
}

run();
