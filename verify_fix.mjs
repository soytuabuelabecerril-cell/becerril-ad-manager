// verify_fix.mjs
// Verifies that the minimal insert strategy now works
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('=== Verifying minimal insert strategy ===\n');

  // Simulates exactly what the app's minimal fallback now does
  const minimalData = {
    action_type: 'send_invoice_email',
    target_id: 'INV-2026-0001',
    customer_name: 'Test Company S.L.',
    product_name: 'Página Completa Interior',
    page_number: 45,
    price: 250,
    design_price: 50,
    vat: 63,
    total: 363,
    payment_method: 'Transfer',
    details: JSON.stringify({
      customer_email: 'test@company.com',
      customer_phone: '+34 600 123 456',
      payment_status: 'Paid',
      is_paid: true,
      emailType: 'invoice',
      subject: 'Factura Nro. INV-2026-0001'
    }),
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('action_logs')
    .insert([minimalData])
    .select();

  if (error) {
    console.error('❌ Minimal insert FAILED:', error.message);
  } else {
    console.log('✅ Minimal insert SUCCEEDED!');
    console.log('Inserted row:', JSON.stringify(data, null, 2));
    
    // Clean up
    if (data?.[0]?.id) {
      await supabase.from('action_logs').delete().eq('id', data[0].id);
      console.log('(Test row cleaned up)');
    }
  }

  // Count total rows
  const { count } = await supabase
    .from('action_logs')
    .select('*', { count: 'exact', head: true });
  console.log(`\nTotal rows currently in action_logs: ${count}`);

  console.log('\n=== SUMMARY ===');
  console.log('The app will now:');
  console.log('  1. Always write logs to localStorage immediately (visible in UI instantly)');
  console.log('  2. Try a full Supabase insert first');
  console.log('  3. If that fails (schema mismatch), do a minimal insert with the 12 working columns');
  console.log('  4. All customer_email, phone, payment_status info is preserved in the details TEXT column');
  console.log('  5. fetchActionLogs() merges Supabase + localStorage so nothing is lost');
  console.log('\nThe permanent fix (run in Supabase SQL Editor) to get full column support:');
  console.log(`
  ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
  ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(100);
  ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
  `);
}

run().catch(console.error);
