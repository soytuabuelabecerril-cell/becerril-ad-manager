// fix_action_logs_schema.mjs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('=== Diagnosing action_logs table ===\n');

  // Test insert with ALL fields the app sends
  const testLog = {
    action_type: 'test_diagnostic',
    target_id: 'TEST-001',
    customer_name: 'Test Customer',
    customer_email: 'test@test.com',
    customer_phone: '+34 600 000 000',
    product_name: 'Test Product',
    page_number: 1,
    price: 0,
    design_price: 0,
    vat: 0,
    total: 0,
    payment_method: null,
    is_paid: false,
    payment_status: 'Test',
    details: { test: true },
    created_at: new Date().toISOString()
  };

  console.log('Testing insert with all required fields...');
  const { data: insertData, error: insertError } = await supabase
    .from('action_logs')
    .insert([testLog])
    .select();

  if (insertError) {
    console.error('\n❌ INSERT FAILED:', insertError.message);
    console.log('\n⚠️  SCHEMA IS MISSING COLUMNS.');
    console.log('\nPlease run this SQL in your Supabase Dashboard > SQL Editor:\n');
    console.log(`
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(100);
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS details JSONB;
    `);
  } else {
    console.log('✅ INSERT SUCCEEDED! The schema is correct.');
    console.log('Row inserted:', JSON.stringify(insertData, null, 2));
    
    // Count total rows
    const { count } = await supabase
      .from('action_logs')
      .select('*', { count: 'exact', head: true });
    console.log(`\nTotal rows in action_logs: ${count}`);
    
    // Clean up test row
    if (insertData?.[0]?.id) {
      await supabase.from('action_logs').delete().eq('id', insertData[0].id);
      console.log('(Test row cleaned up)');
    }
  }
}

run().catch(console.error);
