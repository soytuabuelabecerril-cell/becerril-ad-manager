import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TARGET_PAGES = [14, 15, 17, 18, 19, 24];

async function main() {
  console.log('=== DISCREPANCY REPORT: Cuadricula vs Invoices ===\n');

  // 1. Get all ad_reservations for target pages
  const { data: ads, error: adsErr } = await supabase
    .from('ad_reservations')
    .select('*')
    .in('page_number', TARGET_PAGES)
    .order('page_number');

  if (adsErr) { console.error('Error fetching ad_reservations:', adsErr); process.exit(1); }

  // 2. Get ALL invoices (not just target pages) to understand full picture
  const { data: allInvoices, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (invErr) { console.error('Error fetching invoices:', invErr); process.exit(1); }

  // 3. Get all recibos for target pages
  const { data: recibos, error: recErr } = await supabase
    .from('recibos')
    .select('*')
    .in('assigned_page', TARGET_PAGES)
    .order('assigned_page');

  if (recErr) { console.error('Error fetching recibos:', recErr); process.exit(1); }

  // 4. Get all orders for target pages
  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('*')
    .in('assigned_page', TARGET_PAGES)
    .order('assigned_page');

  if (ordErr) { console.error('Error fetching orders:', ordErr); process.exit(1); }

  const invoicesOnTargetPages = allInvoices.filter(
    inv => TARGET_PAGES.includes(inv.assigned_page) && inv.status !== 'Refund'
  );

  console.log(`📋 AD RESERVATIONS on pages ${TARGET_PAGES.join(', ')} (${ads.length} total):`);
  if (ads.length === 0) {
    console.log('  (none)\n');
  } else {
    ads.forEach(ad => {
      console.log(`  Page ${ad.page_number}: [${ad.ad_type}] ${ad.customer_name} | isPaid=${ad.is_paid} | isRecibo=${ad.is_recibo} | isPreReserved=${ad.is_pre_reserved}`);
    });
    console.log();
  }

  console.log(`🧾 INVOICES on pages ${TARGET_PAGES.join(', ')} (${invoicesOnTargetPages.length} total):`);
  if (invoicesOnTargetPages.length === 0) {
    console.log('  (none)\n');
  } else {
    invoicesOnTargetPages.forEach(inv => {
      console.log(`  Page ${inv.assigned_page}: [${inv.id}] ${inv.customer_name} | ${inv.product_name} | status=${inv.status} | isPaid=${inv.is_paid}`);
    });
    console.log();
  }

  console.log(`💵 RECIBOS on pages ${TARGET_PAGES.join(', ')} (${recibos.length} total):`);
  if (recibos.length === 0) {
    console.log('  (none)\n');
  } else {
    recibos.forEach(rec => {
      console.log(`  Page ${rec.assigned_page}: [${rec.id}] ${rec.customer_name} | ${rec.product_name} | isPaid=${rec.is_paid}`);
    });
    console.log();
  }

  console.log(`📦 ORDERS (pending) on pages ${TARGET_PAGES.join(', ')} (${orders.length} total):`);
  if (orders.length === 0) {
    console.log('  (none)\n');
  } else {
    orders.forEach(ord => {
      console.log(`  Page ${ord.assigned_page}: [${ord.id}] ${ord.customer_name} | ${ord.product_name} | isPaid=${ord.is_paid} | paymentMethod=${ord.payment_method}`);
    });
    console.log();
  }

  // 5. Cross-reference: for each ad reservation, find its corresponding invoice/recibo/order
  console.log('=== CROSS-REFERENCE: Each reservation vs its document ===\n');
  for (const ad of ads) {
    const matchingInvoice = allInvoices.find(
      inv => inv.assigned_page === ad.page_number &&
             inv.customer_name === ad.customer_name &&
             inv.product_name === ad.ad_type &&
             inv.status !== 'Refund'
    );
    const matchingRecibo = recibos.find(
      rec => rec.assigned_page === ad.page_number &&
             rec.customer_name === ad.customer_name &&
             rec.product_name === ad.ad_type
    );
    const matchingOrder = orders.find(
      ord => ord.assigned_page === ad.page_number &&
             ord.customer_name === ad.customer_name &&
             ord.product_name === ad.ad_type
    );

    let status = '';
    if (matchingInvoice) status = `✅ Has invoice: ${matchingInvoice.id} (status=${matchingInvoice.status})`;
    else if (matchingRecibo) status = `🟡 Has recibo: ${matchingRecibo.id} (no invoice — recibos are cash receipts only)`;
    else if (matchingOrder) status = `🔵 Has pending order: ${matchingOrder.id} (awaiting payment confirmation → invoice not yet generated)`;
    else status = `❌ MISSING DOCUMENT — no invoice, recibo or order found!`;

    console.log(`Page ${ad.page_number} | ${ad.customer_name} | ${ad.ad_type}`);
    console.log(`  → ${status}\n`);
  }

  // 6. Summary
  console.log('=== SUMMARY ===');
  console.log(`Total ad reservations on target pages: ${ads.length}`);
  console.log(`Total invoices on target pages: ${invoicesOnTargetPages.length}`);
  console.log(`Total recibos on target pages: ${recibos.length}`);
  console.log(`Total pending orders on target pages: ${orders.length}`);

  const missing = ads.filter(ad => {
    const hasInvoice = allInvoices.some(inv => inv.assigned_page === ad.page_number && inv.customer_name === ad.customer_name && inv.product_name === ad.ad_type && inv.status !== 'Refund');
    const hasRecibo = recibos.some(rec => rec.assigned_page === ad.page_number && rec.customer_name === ad.customer_name && rec.product_name === ad.ad_type);
    const hasOrder = orders.some(ord => ord.assigned_page === ad.page_number && ord.customer_name === ad.customer_name && ord.product_name === ad.ad_type);
    return !hasInvoice && !hasRecibo && !hasOrder;
  });

  if (missing.length > 0) {
    console.log(`\n⚠️  ${missing.length} reservation(s) have NO associated document (invoice, recibo or order):`);
    missing.forEach(ad => {
      console.log(`  → Page ${ad.page_number}: ${ad.customer_name} (${ad.ad_type})`);
    });
  } else {
    console.log('\n✅ All reservations on target pages have an associated document.');
  }
}

main().catch(console.error);
