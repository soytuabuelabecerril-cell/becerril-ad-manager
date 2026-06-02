/**
 * Deletes orphaned ad_reservations for pages 17 and 18 (customer "Testy")
 * that have no corresponding invoice, recibo, or order.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ORPHANED = [
  { page_number: 17, customer_name: 'Testy', ad_type: '1 Página completa impar' },
  { page_number: 18, customer_name: 'Testy', ad_type: '⅔ dos tercios bajo' },
];

async function main() {
  console.log('Signing in...');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'marc.truekalia@gmail.com',
    password: 'Cerce2026!*!'
  });
  if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
  console.log('Signed in.\n');

  for (const entry of ORPHANED) {
    console.log(`Deleting orphaned reservation: Page ${entry.page_number} | "${entry.customer_name}" | ${entry.ad_type}`);
    const { error } = await supabase
      .from('ad_reservations')
      .delete()
      .eq('page_number', entry.page_number)
      .eq('customer_name', entry.customer_name)
      .eq('ad_type', entry.ad_type);

    if (error) {
      console.error(`  ❌ Failed: ${error.message}`);
    } else {
      console.log(`  ✅ Deleted successfully.`);
    }
  }

  // Verify
  console.log('\nVerifying...');
  const { data: remaining } = await supabase
    .from('ad_reservations')
    .select('page_number, customer_name, ad_type')
    .in('page_number', [17, 18]);

  if (!remaining || remaining.length === 0) {
    console.log('✅ Pages 17 and 18 are now clear. You can re-enter them through the app.');
  } else {
    console.log('⚠️  Still found entries:', remaining);
  }
}

main().catch(console.error);
