import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function purge() {
  console.log('--- Database Purge Initiated ---');

  // 1. Delete customer ad reservations (excluding editorial 'legacy' pages)
  console.log('Deleting customer ad reservations...');
  const { error: adErr } = await supabase
    .from('ad_reservations')
    .delete()
    .neq('customer_id', 'legacy');
    
  if (adErr) {
    console.error('Error deleting ad_reservations:', adErr.message);
  } else {
    console.log('✓ Customer ad reservations deleted successfully.');
  }

  // 2. Delete all orders
  console.log('Deleting orders...');
  const { error: ordErr } = await supabase
    .from('orders')
    .delete()
    .neq('id', '__never__');
    
  if (ordErr) {
    console.error('Error deleting orders:', ordErr.message);
  } else {
    console.log('✓ Orders deleted successfully.');
  }

  // 3. Delete all invoices
  console.log('Deleting invoices...');
  const { error: invErr } = await supabase
    .from('invoices')
    .delete()
    .neq('id', '__never__');
    
  if (invErr) {
    console.error('Error deleting invoices:', invErr.message);
  } else {
    console.log('✓ Invoices deleted successfully.');
  }

  // 4. Delete all recibos (receipts)
  console.log('Deleting recibos...');
  const { error: recErr } = await supabase
    .from('recibos')
    .delete()
    .neq('id', '__never__');
    
  if (recErr) {
    console.error('Error deleting recibos:', recErr.message);
  } else {
    console.log('✓ Recibos deleted successfully.');
  }

  // 5. Reset invoice sequential numbering
  console.log('Resetting invoice numbering settings...');
  const { error: settErr } = await supabase
    .from('invoice_settings')
    .upsert({ id: 1, is_sequential_enabled: true, next_invoice_number: 3 });
    
  if (settErr) {
    console.error('Error resetting invoice settings:', settErr.message);
  } else {
    console.log('✓ Invoice settings reset (next invoice: 03_2601).');
  }

  console.log('--- Purge Complete ---');
}

purge().catch(console.error);
