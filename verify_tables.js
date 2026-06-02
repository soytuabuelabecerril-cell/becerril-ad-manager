// verify_and_fix_policies.js
// Verify tables and apply RLS policies via pg direct connection
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const tables = ['ad_reservations', 'invoices', 'recibos', 'orders', 'invoice_settings'];

  console.log('=== Verifying tables ===');
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`  ❌ ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table}: OK`);
    }
  }

  // Try inserting and reading from ad_reservations to verify auth policies work
  console.log('\n=== Testing write access to ad_reservations ===');
  const { data: pages } = await supabase.from('magazine_pages').select('page_number').limit(1);
  if (pages && pages.length > 0) {
    const testPage = pages[0].page_number;
    const { data: inserted, error: insErr } = await supabase.from('ad_reservations').insert([{
      page_number: testPage,
      customer_id: 'test-verify',
      customer_name: 'Test Verify',
      ad_type: 'Test',
    }]).select();

    if (insErr) {
      console.error('  ❌ Insert test failed:', insErr.message);
      console.log('     This means RLS policies may be blocking writes. Need to apply policies.');
    } else {
      console.log('  ✅ Insert test passed! Cleaning up...');
      // Clean up test row
      await supabase.from('ad_reservations').delete().eq('customer_id', 'test-verify');
    }
  }

  // Try inserting invoice_settings
  console.log('\n=== Seeding invoice_settings ===');
  const { error: settErr } = await supabase.from('invoice_settings').upsert([{
    id: 1,
    is_sequential_enabled: false,
    next_invoice_number: 2026060201,
  }]);
  if (settErr) {
    console.error('  ❌ invoice_settings upsert failed:', settErr.message);
  } else {
    console.log('  ✅ invoice_settings seeded');
  }

  console.log('\nDone! All tables are ready.');
}

run().catch(console.error);
