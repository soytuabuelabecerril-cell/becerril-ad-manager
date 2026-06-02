import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('=== FULL DATABASE DUMP (unauthenticated anon read) ===\n');

  // Check ad_reservations - ALL pages
  const { data: ads, error: adsErr } = await supabase
    .from('ad_reservations')
    .select('*')
    .order('page_number');
  console.log(`ad_reservations: ${adsErr ? 'ERROR: ' + adsErr.message : ads.length + ' rows'}`);
  if (ads && ads.length > 0) {
    console.log('Pages with ads:', [...new Set(ads.map(a => a.page_number))].sort((a,b)=>a-b).join(', '));
    ads.forEach(ad => console.log(`  Page ${ad.page_number}: ${ad.customer_name} | ${ad.ad_type} | isPaid=${ad.is_paid} | isRecibo=${ad.is_recibo}`));
  }

  // Check invoices - ALL
  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  console.log(`\ninvoices: ${invErr ? 'ERROR: ' + invErr.message : invoices.length + ' rows'}`);
  if (invoices && invoices.length > 0) {
    invoices.forEach(inv => console.log(`  [${inv.id}] Page ${inv.assigned_page} | ${inv.customer_name} | ${inv.product_name} | status=${inv.status} | isPaid=${inv.is_paid}`));
  }

  // Check recibos - ALL
  const { data: recibos, error: recErr } = await supabase
    .from('recibos')
    .select('*')
    .order('created_at', { ascending: false });
  console.log(`\nrecibos: ${recErr ? 'ERROR: ' + recErr.message : recibos.length + ' rows'}`);
  if (recibos && recibos.length > 0) {
    recibos.forEach(rec => console.log(`  [${rec.id}] Page ${rec.assigned_page} | ${rec.customer_name} | ${rec.product_name}`));
  }

  // Check orders - ALL
  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  console.log(`\norders: ${ordErr ? 'ERROR: ' + ordErr.message : orders.length + ' rows'}`);
  if (orders && orders.length > 0) {
    orders.forEach(ord => console.log(`  [${ord.id}] Page ${ord.assigned_page} | ${ord.customer_name} | ${ord.product_name} | isPaid=${ord.is_paid}`));
  }

  // Check magazine_pages
  const { data: pages, error: pagesErr } = await supabase
    .from('magazine_pages')
    .select('page_number, status')
    .order('page_number');
  console.log(`\nmagazine_pages: ${pagesErr ? 'ERROR: ' + pagesErr.message : pages.length + ' rows'}`);
  if (pages && pages.length > 0) {
    const reserved = pages.filter(p => p.status === 'Reserved');
    const locked = pages.filter(p => p.status === 'Locked');
    console.log(`  Reserved pages (from table): ${reserved.map(p=>p.page_number).join(', ') || 'none'}`);
    console.log(`  Locked pages: ${locked.map(p=>p.page_number).join(', ') || 'none'}`);
  }

  // Invoice settings
  const { data: settings, error: settErr } = await supabase
    .from('invoice_settings')
    .select('*');
  console.log(`\ninvoice_settings: ${settErr ? 'ERROR: ' + settErr.message : JSON.stringify(settings)}`);
}

main().catch(console.error);
