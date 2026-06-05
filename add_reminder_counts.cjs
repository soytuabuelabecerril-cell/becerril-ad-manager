// add_reminder_counts.cjs
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:pBX5dYZR6XcYvJ1EHvzA@db.dfjxmnsozvmfhojnuikx.supabase.co:5432/postgres';

const sql = `
-- Add count columns to ad_reservations
ALTER TABLE public.ad_reservations 
ADD COLUMN IF NOT EXISTS email_reminders_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS whatsapp_reminders_count INT DEFAULT 0;

-- Add count columns to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS email_reminders_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS whatsapp_reminders_count INT DEFAULT 0;
`;

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected directly to database.");

    console.log('Running migration SQL to add reminder count columns...');
    await client.query(sql);
    console.log('✅ Columns added successfully!');
  } catch (err) {
    console.error('Error running SQL:', err.message);
  } finally {
    await client.end();
  }
}

run();
