// add_reminder_fields_rpc.js
import { createClient } from '@supabase/supabase-js';

const projectRef = 'dfjxmnsozvmfhojnuikx';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

const supabase = createClient(`https://${projectRef}.supabase.co`, serviceRoleKey);

const sql1 = `ALTER TABLE public.ad_reservations ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;`;
const sql2 = `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;`;

async function run() {
  console.log('Running ALTER TABLE via RPC exec_sql...');
  
  const { error: err1 } = await supabase.rpc('exec_sql', { sql: sql1 });
  if (err1) {
    console.error('Error adding column to ad_reservations:', err1.message);
  } else {
    console.log('Successfully added reminder_sent_at to ad_reservations.');
  }

  const { error: err2 } = await supabase.rpc('exec_sql', { sql: sql2 });
  if (err2) {
    console.error('Error adding column to orders:', err2.message);
  } else {
    console.log('Successfully added reminder_sent_at to orders.');
  }
}

run().catch(console.error);
