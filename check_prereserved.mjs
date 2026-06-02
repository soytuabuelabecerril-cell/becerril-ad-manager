import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'marc.truekalia@gmail.com',
    password: 'Cerce2026!*!'
  });
  if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }

  console.log('=== ALL AD_RESERVATIONS (pre-reserved ones highlighted) ===\n');
  const { data: ads } = await supabase.from('ad_reservations').select('*').order('page_number');
  console.log(`Total ad_reservations: ${ads?.length || 0}`);
  ads?.forEach(ad => {
    const flag = ad.is_pre_reserved ? '🔶 PRE-RESERVED' : '✅ normal';
    console.log(`  ${flag} | Page ${ad.page_number} | "${ad.customer_name}" | ${ad.ad_type} | isPaid=${ad.is_paid} | expires=${ad.expires_at}`);
  });

  console.log('\n=== ALL ORDERS (pre-reserved type) ===\n');
  const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  console.log(`Total orders: ${orders?.length || 0}`);
  orders?.forEach(o => {
    const flag = o.order_type === 'pre-reserved' ? '🔶 PRE-RESERVED' : '📦 transfer';
    console.log(`  ${flag} | Page ${o.assigned_page} | "${o.customer_name}" | ${o.product_name} | isPaid=${o.is_paid} | type=${o.order_type}`);
  });

  console.log('\n=== SUMMARY: What should show in Pre-reservado tab ===\n');
  const preReservedAds = ads?.filter(a => a.is_pre_reserved) || [];
  const preReservedOrders = orders?.filter(o => o.order_type === 'pre-reserved' && !o.is_paid) || [];
  console.log(`Pre-reserved ad_reservations: ${preReservedAds.length}`);
  preReservedAds.forEach(a => console.log(`  → Page ${a.page_number}: "${a.customer_name}" expires ${a.expires_at}`));
  console.log(`Pre-reserved orders (unpaid): ${preReservedOrders.length}`);
  preReservedOrders.forEach(o => console.log(`  → Page ${o.assigned_page}: "${o.customer_name}"`));

  if (preReservedAds.length === 0 && preReservedOrders.length === 0) {
    console.log('\n⚠️  NO pre-reserved entries at all — the Pre-reservado tab will be empty.');
    console.log('   The user needs to create a new pre-reservation through the Cuadricula to test the buttons.');
  }
}

main().catch(console.error);
