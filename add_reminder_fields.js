// add_reminder_fields.js


const projectRef = 'dfjxmnsozvmfhojnuikx';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

const sql = `
-- Add reminder_sent_at to ad_reservations
ALTER TABLE public.ad_reservations 
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Add reminder_sent_at to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
`;

async function run() {
  console.log('Altering tables to add reminder_sent_at...\n');

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const text = await response.text();
  console.log('Response:', text);
}

run().catch(console.error);
