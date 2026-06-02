// test_auth_write.mjs - Create temp user and test writing to all tables
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY';
const BASE = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const { createClient } = await import('@supabase/supabase-js');

// Create temp user
const testEmail = `test-write-${Date.now()}@test.com`;
const createRes = await fetch(`${BASE}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: testEmail, password: 'TestPass123!', email_confirm: true })
});
const created = await createRes.json();
const testUserId = created.id;

// Sign in as the temp user
const supabase = createClient(BASE, ANON_KEY);
const { data: auth } = await supabase.auth.signInWithPassword({ email: testEmail, password: 'TestPass123!' });
console.log('Signed in as temp user');

// Test inserting an order (exactly as the app does)
const { data: order, error: ordErr } = await supabase.from('orders').insert([{
  id: 'ORD-AUTH-TEST',
  status: 'Pending',
  is_paid: false,
  payment_method: 'Transfer',
  customer_name: 'Test Customer',
  product_name: 'Cuarto de página',
  price: 250,
  design_price: 0,
  assigned_page: 15,
  artwork_comment: 'Test',
  order_type: 'transfer',
  customer_email: 'test@test.com',
  customer_phone: '123456789'
}]).select();
console.log('orders INSERT (as auth user):', order ? '✅ OK' : `❌ FAILED: ${ordErr?.message}`);

// Test inserting an ad_reservation (exactly as the app does)
const { data: ad, error: adErr } = await supabase.from('ad_reservations').insert([{
  page_number: 15,
  customer_id: 'test-auth-user',
  customer_name: 'Test Customer',
  ad_type: 'Cuarto de página',
  is_pre_reserved: false,
  artwork_option: '1',
  design_work_price: 0,
  is_paid: false,
  payment_method: 'Transfer',
  is_new: true,
  is_recibo: false
}]).select();
console.log('ad_reservations INSERT (as auth user):', ad ? '✅ OK' : `❌ FAILED: ${adErr?.message}`);

// Test inserting a recibo  
const { data: rec, error: recErr } = await supabase.from('recibos').insert([{
  id: 'REC-AUTH-TEST',
  status: 'Active',
  payment_method: 'Cash',
  is_paid: true,
  is_recibo: true,
  customer_name: 'Test Customer',
  product_name: 'Cuarto de página',
  price: 250,
  design_price: 0,
  total: 250,
  assigned_page: 15
}]).select();
console.log('recibos INSERT (as auth user):', rec ? '✅ OK' : `❌ FAILED: ${recErr?.message}`);

// Clean up
await supabase.from('orders').delete().eq('id', 'ORD-AUTH-TEST');
await supabase.from('ad_reservations').delete().eq('customer_id', 'test-auth-user');
await supabase.from('recibos').delete().eq('id', 'REC-AUTH-TEST');

// Delete temp user
await fetch(`${BASE}/auth/v1/admin/users/${testUserId}`, {
  method: 'DELETE',
  headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
});
console.log('\nTemp user deleted. Test complete.');
