// add_reminder_counts_rpc.js
import { createClient } from '@supabase/supabase-js';

const projectRef = 'dfjxmnsozvmfhojnuikx';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

const supabase = createClient(`https://${projectRef}.supabase.co`, serviceRoleKey);

const queries = [
  `ALTER TABLE public.ad_reservations ADD COLUMN IF NOT EXISTS email_reminders_count INT DEFAULT 0;`,
  `ALTER TABLE public.ad_reservations ADD COLUMN IF NOT EXISTS whatsapp_reminders_count INT DEFAULT 0;`,
  `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email_reminders_count INT DEFAULT 0;`,
  `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS whatsapp_reminders_count INT DEFAULT 0;`
];

async function run() {
  console.log('Running ALTER TABLE via RPC exec_sql...');
  
  for (const sql of queries) {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error(`Error executing SQL [${sql}]:`, error.message);
    } else {
      console.log(`Successfully executed SQL [${sql}]`);
    }
  }
  console.log('Migration finished.');
}

run().catch(console.error);
