import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('action_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching action_logs:', error.message);
  } else {
    console.log(`Fetched ${data.length} logs:`);
    data.forEach(log => {
      console.log(`[${log.created_at}] Action: ${log.action} | Customer: ${log.customer_name} | Page: ${log.page_number} | Details:`, JSON.stringify(log.details));
    });
  }
}

run();
