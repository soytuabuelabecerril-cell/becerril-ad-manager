import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("Checking database records for Page 10...\n");

    const { data: page, error: pageErr } = await supabase
      .from('magazine_pages')
      .select('*')
      .eq('page_number', 10)
      .single();

    if (pageErr) console.error("Error fetching magazine_pages for page 10:", pageErr);
    else console.log("magazine_pages record:", JSON.stringify(page, null, 2));

    const { data: ads, error: adsErr } = await supabase
      .from('ad_reservations')
      .select('*')
      .eq('page_number', 10);

    if (adsErr) console.error("Error fetching ad_reservations for page 10:", adsErr);
    else console.log("ad_reservations records:", JSON.stringify(ads, null, 2));

    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('*')
      .eq('assigned_page', 10);

    if (ordersErr) console.error("Error fetching orders for page 10:", ordersErr);
    else console.log("orders records:", JSON.stringify(orders, null, 2));

    const { data: recibos, error: recibosErr } = await supabase
      .from('recibos')
      .select('*')
      .eq('assigned_page', 10);

    if (recibosErr) console.error("Error fetching recibos for page 10:", recibosErr);
    else console.log("recibos records:", JSON.stringify(recibos, null, 2));

    const { data: invoices, error: invoicesErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('assigned_page', 10);

    if (invoicesErr) console.error("Error fetching invoices for page 10:", invoicesErr);
    else console.log("invoices records:", JSON.stringify(invoices, null, 2));

    const { data: logs, error: logsErr } = await supabase
      .from('action_logs')
      .select('*')
      .eq('page_number', 10)
      .order('created_at', { ascending: false });

    if (logsErr) console.error("Error fetching action_logs for page 10:", logsErr);
    else console.log("action_logs records:", JSON.stringify(logs, null, 2));

  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

run();
