/**
 * Discrepancy check script - signs in with Supabase auth to bypass RLS
 * Usage: node check_auth.mjs <email> <password>
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const [,, email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node check_auth.mjs <email> <password>');
  process.exit(1);
}

const TARGET_PAGES = [14, 15, 17, 18, 19, 24];

async function main() {
  console.log(`Signing in as ${email}...`);
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
  console.log('Signed in successfully.\n');

  console.log('=== DISCREPANCY REPORT: Cuadricula vs Invoices ===\n');

  // 1. Get all ad_reservations for target pages
  const { data: ads, error: adsErr } = await supabase
    .from('ad_reservations')
    .select('*')
    .in('page_number', TARGET_PAGES)
    .order('page_number');

  if (adsErr) { console.error('Error fetching ad_reservations:', adsErr); process.exit(1); }

  // 2. Get ALL invoices
  const { data: allInvoices, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  if (invErr) { console.error('Error fetching invoices:', invErr); process.exit(1); }

  // 3. Get all recibos for target pages
  const { data: recibos, error: recErr } = await supabase
    .from('recibos')
    .select('*')
    .in('assigned_page', TARGET_PAGES);
  if (recErr) { console.error('Error fetching recibos:', recErr); process.exit(1); }

  // 4. Get all orders for target pages
  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('*')
    .in('assigned_page', TARGET_PAGES);
  if (ordErr) { console.error('Error fetching orders:', ordErr); process.exit(1); }

  const invoicesOnTargetPages = allInvoices.filter(
    inv => TARGET_PAGES.includes(inv.assigned_page) && inv.status !== 'Refund'
  );

  console.log(`📋 AD RESERVATIONS on pages ${TARGET_PAGES.join(', ')} (${ads.length} total):`);
  if (ads.length === 0) console.log('  (none)\n');
  else {
    ads.forEach(ad => console.log(`  Page ${ad.page_number}: [${ad.ad_type}] "${ad.customer_name}" | isPaid=${ad.is_paid} | isRecibo=${ad.is_recibo} | isPreReserved=${ad.is_pre_reserved}`));
    console.log();
  }

  console.log(`🧾 INVOICES on pages ${TARGET_PAGES.join(', ')} (${invoicesOnTargetPages.length} total):`);
  if (invoicesOnTargetPages.length === 0) console.log('  (none)\n');
  else {
    invoicesOnTargetPages.forEach(inv => console.log(`  Page ${inv.assigned_page}: [${inv.id}] "${inv.customer_name}" | ${inv.product_name} | status=${inv.status} | isPaid=${inv.is_paid}`));
    console.log();
  }

  console.log(`💵 RECIBOS on pages ${TARGET_PAGES.join(', ')} (${recibos.length} total):`);
  if (recibos.length === 0) console.log('  (none)\n');
  else {
    recibos.forEach(rec => console.log(`  Page ${rec.assigned_page}: [${rec.id}] "${rec.customer_name}" | ${rec.product_name}`));
    console.log();
  }

  console.log(`📦 ORDERS (pending) on pages ${TARGET_PAGES.join(', ')} (${orders.length} total):`);
  if (orders.length === 0) console.log('  (none)\n');
  else {
    orders.forEach(ord => console.log(`  Page ${ord.assigned_page}: [${ord.id}] "${ord.customer_name}" | ${ord.product_name} | payMethod=${ord.payment_method}`));
    console.log();
  }

  // 5. Cross-reference: for each ad reservation, find its corresponding document
  console.log('=== CROSS-REFERENCE: Each reservation vs its document ===\n');
  for (const ad of ads) {
    const matchInvoice = allInvoices.find(inv =>
      inv.assigned_page === ad.page_number &&
      inv.customer_name === ad.customer_name &&
      inv.product_name === ad.ad_type &&
      inv.status !== 'Refund'
    );
    const matchRecibo = recibos.find(rec =>
      rec.assigned_page === ad.page_number &&
      rec.customer_name === ad.customer_name &&
      rec.product_name === ad.ad_type
    );
    const matchOrder = orders.find(ord =>
      ord.assigned_page === ad.page_number &&
      ord.customer_name === ad.customer_name &&
      ord.product_name === ad.ad_type
    );

    let status = '';
    if (matchInvoice) status = `✅ Invoice: ${matchInvoice.id} (status=${matchInvoice.status}, isPaid=${matchInvoice.is_paid})`;
    else if (matchRecibo) status = `🟡 Recibo only: ${matchRecibo.id} — cash receipt, NOT an invoice (by design)`;
    else if (matchOrder) status = `🔵 Pending order: ${matchOrder.id} (payment_method=${matchOrder.payment_method}) — invoice generated only on payment confirmation`;
    else status = `❌ MISSING — no invoice, recibo, or order found!`;

    console.log(`Page ${ad.page_number} | "${ad.customer_name}" | ${ad.ad_type}`);
    console.log(`  → ${status}\n`);
  }

  // 6. Also show all invoices summary
  console.log('=== ALL INVOICES IN SYSTEM ===');
  if (allInvoices.length === 0) {
    console.log('  No invoices at all.\n');
  } else {
    const active = allInvoices.filter(i => i.status === 'Active');
    const cancelled = allInvoices.filter(i => i.status === 'Cancelled');
    const reserved = allInvoices.filter(i => i.status === 'Reserved');
    const refunds = allInvoices.filter(i => i.status === 'Refund');
    console.log(`  Total: ${allInvoices.length} | Active: ${active.length} | Cancelled: ${cancelled.length} | Reserved IDs: ${reserved.length} | Refunds: ${refunds.length}`);
    console.log('\n  Active invoices by page:');
    active.forEach(inv => console.log(`    Page ${inv.assigned_page}: [${inv.id}] "${inv.customer_name}" | ${inv.product_name} | isPaid=${inv.is_paid}`));
  }

  // 7. Summary
  const missing = ads.filter(ad => {
    const hasInvoice = allInvoices.some(inv => inv.assigned_page === ad.page_number && inv.customer_name === ad.customer_name && inv.product_name === ad.ad_type && inv.status !== 'Refund');
    const hasRecibo = recibos.some(rec => rec.assigned_page === ad.page_number && rec.customer_name === ad.customer_name && rec.product_name === ad.ad_type);
    const hasOrder = orders.some(ord => ord.assigned_page === ad.page_number && ord.customer_name === ad.customer_name && ord.product_name === ad.ad_type);
    return !hasInvoice && !hasRecibo && !hasOrder;
  });

  const reciboOnly = ads.filter(ad =>
    recibos.some(rec => rec.assigned_page === ad.page_number && rec.customer_name === ad.customer_name && rec.product_name === ad.ad_type) &&
    !allInvoices.some(inv => inv.assigned_page === ad.page_number && inv.customer_name === ad.customer_name && inv.product_name === ad.ad_type && inv.status !== 'Refund')
  );

  const orderOnly = ads.filter(ad =>
    orders.some(ord => ord.assigned_page === ad.page_number && ord.customer_name === ad.customer_name && ord.product_name === ad.ad_type) &&
    !allInvoices.some(inv => inv.assigned_page === ad.page_number && inv.customer_name === ad.customer_name && inv.product_name === ad.ad_type && inv.status !== 'Refund')
  );

  console.log('\n=== ROOT CAUSE ANALYSIS ===');
  if (missing.length > 0) {
    console.log(`\n❌ ${missing.length} reservation(s) COMPLETELY UNLINKED (no invoice, no recibo, no order):`);
    missing.forEach(ad => console.log(`   → Page ${ad.page_number}: "${ad.customer_name}" (${ad.ad_type})`));
    console.log('   ROOT CAUSE: These reservations may have been created manually or via a bug — they have no document.');
  }
  if (reciboOnly.length > 0) {
    console.log(`\n🟡 ${reciboOnly.length} reservation(s) were done as RECIBO (cash, no VAT invoice):`);
    reciboOnly.forEach(ad => console.log(`   → Page ${ad.page_number}: "${ad.customer_name}" (${ad.ad_type})`));
    console.log('   ROOT CAUSE: Recibos are intentionally separate from invoices. They appear in the "Recibos" tab, not "Facturas".');
  }
  if (orderOnly.length > 0) {
    console.log(`\n🔵 ${orderOnly.length} reservation(s) are PENDING ORDERS (invoice will generate on payment confirmation):`);
    orderOnly.forEach(ad => console.log(`   → Page ${ad.page_number}: "${ad.customer_name}" (${ad.ad_type})`));
    console.log('   ROOT CAUSE: Transfer/pre-reservations only generate an invoice when you click "Confirm Payment" in the Pending Orders list.');
  }
  if (missing.length === 0 && reciboOnly.length === 0 && orderOnly.length === 0 && ads.length > 0) {
    console.log('\n✅ All reservations have a corresponding invoice.');
  }
  if (ads.length === 0) {
    console.log('\n⚠️  No ad_reservations found for pages 14,15,17,18,19,24. The Cuadricula data may be stored differently.');
  }
}

main().catch(console.error);
