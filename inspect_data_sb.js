import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data: ads } = await supabase.from('ad_reservations').select('*');
    console.log("\n--- ad_reservations ---");
    console.log(JSON.stringify(ads, null, 2));

    const { data: orders } = await supabase.from('orders').select('*');
    console.log("\n--- orders ---");
    console.log(JSON.stringify(orders, null, 2));

    const { data: customers } = await supabase.from('customers').select('*');
    console.log("\n--- customers ---");
    console.log(JSON.stringify(customers, null, 2));
  } catch (err) {
    console.error("Error inspecting database:", err);
  }
}

run();
