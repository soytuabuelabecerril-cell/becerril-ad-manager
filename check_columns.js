// check_columns.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: invData, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .limit(1);
  
  if (invErr) {
    console.error('Invoices Error:', invErr);
  } else {
    console.log('Invoices columns:', invData[0] ? Object.keys(invData[0]) : 'No rows');
  }

  const { data: recData, error: recErr } = await supabase
    .from('recibos')
    .select('*')
    .limit(1);

  if (recErr) {
    console.error('Recibos Error:', recErr);
  } else {
    console.log('Recibos columns:', recData[0] ? Object.keys(recData[0]) : 'No rows');
  }
}

run();
