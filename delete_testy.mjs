import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDkzNzgsImV4cCI6MjA5NTg4NTM3OH0.Yfiv2kRf5I_bHy4EHgWFqQMKArGvRuzeutcfaX6ttpY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function deleteTesty() {
  const name = 'Testy';

  // 1. Delete ad_reservations for this customer
  const { error: adErr, data: adData } = await supabase
    .from('ad_reservations')
    .delete()
    .ilike('customer_name', name)
    .select();
  if (adErr) console.error('ad_reservations error:', adErr.message);
  else console.log(`✓ ad_reservations deleted: ${adData?.length ?? 0} row(s)`);

  // 2. Delete orders for this customer
  const { error: ordErr, data: ordData } = await supabase
    .from('orders')
    .delete()
    .ilike('customer_name', name)
    .select();
  if (ordErr) console.error('orders error:', ordErr.message);
  else console.log(`✓ orders deleted: ${ordData?.length ?? 0} row(s)`);

  // 3. Delete from customers table (nif = TESTY-1234 or commercial_name = Testy)
  const { error: custErr, data: custData } = await supabase
    .from('customers')
    .delete()
    .or('commercial_name.ilike.Testy,nif.eq.TESTY-1234')
    .select();
  if (custErr) console.error('customers error:', custErr.message);
  else console.log(`✓ customers deleted: ${custData?.length ?? 0} row(s)`);

  console.log('\nDone.');
}

deleteTesty().catch(console.error);
