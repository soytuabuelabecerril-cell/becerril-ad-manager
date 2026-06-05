import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- Inspecting Current DB State ---');
  
  const { data: activePages, error: pagesErr } = await supabase
    .from('magazine_pages')
    .select('*')
    .neq('status', 'Available');
    
  if (pagesErr) {
    console.error('Error fetching magazine_pages:', pagesErr.message);
  } else {
    console.log(`Non-Available magazine_pages count: ${activePages.length}`);
    console.log('Sample non-available pages:', activePages.slice(0, 10));
  }
  
  const { data: pageCustomers, error: custPagesErr } = await supabase
    .from('magazine_pages')
    .select('*')
    .not('customer_id', 'is', null);
    
  if (custPagesErr) {
    console.error('Error fetching magazine_pages with customer_id:', custPagesErr.message);
  } else {
    console.log(`magazine_pages with customer_id count: ${pageCustomers.length}`);
  }

  const { count: ordCount, error: ordErr } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });
  console.log(`Orders count: ${ordErr ? ordErr.message : ordCount}`);

  const { count: resCount, error: resErr } = await supabase
    .from('ad_reservations')
    .select('*', { count: 'exact', head: true });
  console.log(`Ad reservations count: ${resErr ? resErr.message : resCount}`);

  const { count: invCount, error: invErr } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true });
  console.log(`Invoices count: ${invErr ? invErr.message : invCount}`);

  const { count: recCount, error: recErr } = await supabase
    .from('recibos')
    .select('*', { count: 'exact', head: true });
  console.log(`Recibos count: ${recErr ? recErr.message : recCount}`);
}

run();
