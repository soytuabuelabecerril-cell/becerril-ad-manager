// test_admin_impersonate.mjs - Test as authenticated user via admin token
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const USER_ID = '029377bc-a2b7-4fe2-bf01-9ed8bb409694'; // sbs.comite@gmail.com
const BASE = 'https://dfjxmnsozvmfhojnuikx.supabase.co';

// Generate a link for a user to sign in (impersonate session)
const r = await fetch(`${BASE}/auth/v1/admin/users/${USER_ID}/generate_link`, {
  method: 'POST',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ type: 'magiclink' })
});

const linkData = await r.json();
if (!r.ok) {
  console.error('Generate link failed:', linkData);
  process.exit(1);
}

// Extract the access token from the link
const url = new URL(linkData.action_link);
const token = url.searchParams.get('token');
console.log('Got OTP token, verifying...');

// Exchange OTP for session
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(BASE, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY');

const { data: session, error: sessErr } = await supabase.auth.verifyOtp({
  token_hash: token,
  type: 'magiclink'
});

if (sessErr) {
  console.error('Session error:', sessErr.message);
  // Try with access_token directly from linkData
  console.log('Link data keys:', Object.keys(linkData));
}

if (session?.session?.access_token) {
  console.log('Got real user session!');
  const { createClient: cc } = await import('@supabase/supabase-js');
  const authSupabase = cc(BASE, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY', {
    global: { headers: { Authorization: `Bearer ${session.session.access_token}` } }
  });

  const { data: pages, error: pErr } = await authSupabase.from('magazine_pages').select('page_number,status').order('page_number');
  console.log('magazine_pages as user:', pages?.length, 'error:', pErr?.message);
  
  const { data: ads, error: aErr } = await authSupabase.from('ad_reservations').select('*');
  console.log('ad_reservations as user:', ads?.length, 'error:', aErr?.message);
}
