import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: customers, error: custErr } = await supabase.from('customers').select('*');
  if (custErr) console.error("Customers error:", custErr);

  console.log("=== CUSTOMERS WITH NIF 1234 OR NAME CONTAINING A ===");
  console.log(customers?.filter(c => c.nif === '1234' || c.commercial_name?.toLowerCase().includes('a') || c.fiscal_name?.toLowerCase().includes('a')));
}

run();
