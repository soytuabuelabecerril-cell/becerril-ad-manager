// test_as_user.mjs - Sign in as a real user and test what pages they see
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dfjxmnsozvmfhojnuikx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY'
);

// Sign in
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: 'sbs.comite@gmail.com',
  password: 'Beceril2026!*!'
});

if (authErr) {
  console.error('Auth error:', authErr.message);
  process.exit(1);
}

console.log('Signed in as:', auth.user.email);

// Now test magazine_pages
const { data: pages, error: pagesErr } = await supabase
  .from('magazine_pages')
  .select('*')
  .order('page_number', { ascending: true });

console.log('magazine_pages count:', pages?.length, 'error:', pagesErr?.message);

// Test ad_reservations
const { data: ads, error: adsErr } = await supabase
  .from('ad_reservations')
  .select('*');

console.log('ad_reservations count:', ads?.length, 'error:', adsErr?.message);

// Test invoices
const { data: invoices, error: invErr } = await supabase
  .from('invoices')
  .select('*');

console.log('invoices count:', invoices?.length, 'error:', invErr?.message);

await supabase.auth.signOut();
console.log('Done.');
