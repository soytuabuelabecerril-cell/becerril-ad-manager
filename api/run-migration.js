// api/run-migration.js
import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres:pBX5dYZR6XcYvJ1EHvzA@db.dfjxmnsozvmfhojnuikx.supabase.co:5432/postgres';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // 1. Alter ad_reservations
    await client.query(`
      ALTER TABLE public.ad_reservations 
      ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    // 2. Alter orders
    await client.query(`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    return res.status(200).json({ success: true, message: 'Database migrated successfully!' });
  } catch (err) {
    console.error('Migration failed:', err);
    return res.status(500).json({ error: 'Migration failed', details: err.message });
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}
