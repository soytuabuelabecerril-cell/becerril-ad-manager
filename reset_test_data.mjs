import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function reset() {
  console.log('Starting test data reset...\n');

  // Sign in as admin to bypass RLS (using stored credentials)
  // We'll use the service role anon key — if this fails, RLS will block us
  // and the user will need to run the SQL manually.

  // 1. Delete all invoices
  const { error: invErr, count: invCount } = await supabase
    .from('invoices')
    .delete()
    .neq('id', '__never__'); // delete all rows
  if (invErr) {
    console.error('Error deleting invoices:', invErr.message);
  } else {
    console.log('✓ Invoices cleared');
  }

  // 2. Delete all recibos
  const { error: recErr } = await supabase
    .from('recibos')
    .delete()
    .neq('id', '__never__');
  if (recErr) {
    console.error('Error deleting recibos:', recErr.message);
  } else {
    console.log('✓ Recibos cleared');
  }

  // 3. Delete all orders
  const { error: ordErr } = await supabase
    .from('orders')
    .delete()
    .neq('id', '__never__');
  if (ordErr) {
    console.error('Error deleting orders:', ordErr.message);
  } else {
    console.log('✓ Orders cleared');
  }

  // 4. Delete all ad_reservations
  const { error: adErr } = await supabase
    .from('ad_reservations')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (adErr) {
    console.error('Error deleting ad_reservations:', adErr.message);
  } else {
    console.log('✓ Ad reservations cleared');
  }

  // 5. Reset invoice_settings: sequential ON, next number = 3 → first invoice = 03_2601
  const { error: settErr } = await supabase
    .from('invoice_settings')
    .upsert({ id: 1, is_sequential_enabled: true, next_invoice_number: 3 });
  if (settErr) {
    console.error('Error resetting invoice settings:', settErr.message);
  } else {
    console.log('✓ Invoice settings reset: sequential=true, next_number=3 (→ 03_2601)');
  }

  console.log('\nDone. Next invoice will be: 03_2601');
}

reset().catch(console.error);
