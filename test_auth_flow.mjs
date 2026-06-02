// test_auth_flow.mjs - Create a temp user, test as them, then delete
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY';
const BASE = 'https://dfjxmnsozvmfhojnuikx.supabase.co';

const { createClient } = await import('@supabase/supabase-js');

// Step 1: Create a temporary test user
const testEmail = `test-verify-${Date.now()}@test.com`;
const testPassword = 'TestPass123!';

const createRes = await fetch(`${BASE}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: testEmail, password: testPassword, email_confirm: true })
});
const created = await createRes.json();
if (!createRes.ok) { console.error('Create user failed:', created); process.exit(1); }
const testUserId = created.id;
console.log('Created test user:', testEmail, '(id:', testUserId + ')');

// Step 2: Sign in as that user
const supabase = createClient(BASE, ANON_KEY);
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
if (authErr) { console.error('Sign in failed:', authErr.message); }
else {
  console.log('Signed in successfully as test user');

  // Step 3: Test table access
  const { count: pages, error: pErr } = await supabase.from('magazine_pages').select('*', { count: 'exact', head: true });
  console.log('magazine_pages (authenticated):', pages, pErr ? '❌ ' + pErr.message : '✅');

  const { count: ads, error: aErr } = await supabase.from('ad_reservations').select('*', { count: 'exact', head: true });
  console.log('ad_reservations (authenticated):', ads, aErr ? '❌ ' + aErr.message : '✅');

  const { count: invs, error: iErr } = await supabase.from('invoices').select('*', { count: 'exact', head: true });
  console.log('invoices (authenticated):', invs, iErr ? '❌ ' + iErr.message : '✅');

  const { count: custs, error: cErr } = await supabase.from('customers').select('*', { count: 'exact', head: true });
  console.log('customers (authenticated):', custs, cErr ? '❌ ' + cErr.message : '✅');
}

// Step 4: Delete the temp user
await fetch(`${BASE}/auth/v1/admin/users/${testUserId}`, {
  method: 'DELETE',
  headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
});
console.log('\nTest user deleted. Done.');
