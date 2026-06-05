// test_full_insert.mjs
// Tests inserting with ALL fields including is_paid
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  // Test the FULL schema (what logAction sends)
  const fullData = {
    action_type: 'send_invoice_email',
    target_id: 'FULL-TEST-001',
    customer_name: 'Full Test S.L.',
    customer_email: 'full@test.com',
    customer_phone: '+34 600 999 888',
    product_name: 'Página Completa Interior',
    page_number: 45,
    price: 250,
    design_price: 50,
    vat: 63,
    total: 363,
    payment_method: 'Transfer',
    is_paid: true,
    payment_status: 'Paid',
    details: { emailType: 'invoice', subject: 'Test' },
    created_at: new Date().toISOString()
  };

  console.log('Testing FULL insert (all columns including is_paid)...');
  const { data, error } = await supabase.from('action_logs').insert([fullData]).select();

  if (error) {
    console.error('❌ FULL insert FAILED:', error.message);
    console.log('\nOnly the minimal insert will work. The app code is correct as-is.');
  } else {
    console.log('✅ FULL insert SUCCEEDED!');
    console.log('All columns are now in the schema!');
    console.log('The app should now work perfectly without any fallback needed.');
    if (data?.[0]?.id) {
      await supabase.from('action_logs').delete().eq('id', data[0].id);
      console.log('(Test row cleaned up)');
    }
  }
}

run().catch(console.error);
