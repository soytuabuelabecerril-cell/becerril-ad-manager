import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: ads, error: err1 } = await supabase.from('ad_reservations').select('*').limit(5);
  console.log("Sample ad_reservations:", ads);
  
  const { data: orders, error: err2 } = await supabase.from('orders').select('*').limit(5);
  console.log("Sample orders:", orders);

  const { data: customers, error: err3 } = await supabase.from('customers').select('*').limit(5);
  console.log("Sample customers:", customers);
}

run();
