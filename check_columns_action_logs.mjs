// check_columns_action_logs.mjs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  // Try to insert columns one at a time to find what's accepted
  const tests = [
    { action_type: 'col_test', created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', customer_name: 'A', created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', customer_name: 'A', product_name: 'B', created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', customer_name: 'A', product_name: 'B', page_number: 1, created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', customer_name: 'A', product_name: 'B', page_number: 1, price: 0, created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', customer_name: 'A', product_name: 'B', page_number: 1, price: 0, design_price: 0, vat: 0, total: 0, payment_method: null, created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', customer_name: 'A', product_name: 'B', page_number: 1, price: 0, design_price: 0, vat: 0, total: 0, payment_method: null, details: 'text', created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', customer_name: 'A', product_name: 'B', page_number: 1, price: 0, design_price: 0, vat: 0, total: 0, payment_method: null, details: JSON.stringify({x:1}), created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', customer_name: 'A', product_name: 'B', page_number: 1, price: 0, design_price: 0, vat: 0, total: 0, payment_method: null, details: JSON.stringify({x:1}), is_paid: false, created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', customer_name: 'A', product_name: 'B', page_number: 1, price: 0, design_price: 0, vat: 0, total: 0, payment_method: null, details: JSON.stringify({x:1}), is_paid: false, customer_email: 'a@b.com', created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', customer_name: 'A', product_name: 'B', page_number: 1, price: 0, design_price: 0, vat: 0, total: 0, payment_method: null, details: JSON.stringify({x:1}), is_paid: false, customer_email: 'a@b.com', customer_phone: '123', created_at: new Date().toISOString() },
    { action_type: 'col_test', target_id: 'X', customer_name: 'A', product_name: 'B', page_number: 1, price: 0, design_price: 0, vat: 0, total: 0, payment_method: null, details: JSON.stringify({x:1}), is_paid: false, customer_email: 'a@b.com', customer_phone: '123', payment_status: 'Pending', created_at: new Date().toISOString() },
  ];

  let lastSuccess = null;
  for (let i = 0; i < tests.length; i++) {
    const { error } = await supabase.from('action_logs').insert([tests[i]]);
    if (error) {
      console.log(`Test ${i+1}: FAIL - ${error.message}`);
      console.log(`Last successful column set: ${JSON.stringify(Object.keys(lastSuccess || tests[0]))}`);
      break;
    } else {
      lastSuccess = tests[i];
      console.log(`Test ${i+1}: OK - cols: ${Object.keys(tests[i]).join(', ')}`);
    }
  }

  // Clean up
  await supabase.from('action_logs').delete().eq('action_type', 'col_test');
  console.log('\nCleaned up test rows.');
}

run().catch(console.error);
