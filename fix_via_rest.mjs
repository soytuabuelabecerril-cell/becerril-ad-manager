// fix_via_rest.mjs
// Uses Supabase REST API with service role to add missing columns
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Use the Supabase SQL query endpoint that accepts service_role JWT
async function runSQL(sql) {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ query: sql })
  });
  return { status: res.status, body: await res.text() };
}

// Alternative: try calling a stored procedure / RPC that runs SQL
async function runSQLviaRPC(sql) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql })
  });
  return { status: res.status, body: await res.text() };
}

async function run() {
  console.log('=== Fixing action_logs schema via REST API ===\n');

  // The missing columns
  const alterStatements = [
    `ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);`,
    `ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(100);`,
    `ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);`,
    `ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;`,
    `ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS details JSONB;`,
  ];

  console.log('Trying exec_sql RPC approach...');
  for (const sql of alterStatements) {
    const result = await runSQLviaRPC(sql);
    console.log(`  ${sql.substring(0, 55)}... → HTTP ${result.status}: ${result.body.substring(0, 100)}`);
  }

  // Verify by trying the insert again
  console.log('\nTesting insert after fix attempts...');
  const testLog = {
    action_type: 'test_after_fix',
    target_id: 'TEST-002',
    customer_name: 'Test Fix',
    customer_email: 'test@fix.com',
    customer_phone: '+34 600 000 001',
    product_name: 'Test',
    page_number: 1,
    price: 0,
    design_price: 0,
    vat: 0,
    total: 0,
    payment_method: null,
    is_paid: false,
    payment_status: 'Pending',
    details: { fixed: true },
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('action_logs').insert([testLog]).select();
  if (error) {
    console.error('❌ Still failing:', error.message);
    console.log('\nThe exec_sql RPC did not work either.');
    console.log('\n===== MANUAL FIX REQUIRED =====');
    console.log('Go to: https://supabase.com/dashboard/project/dfjxmnsozvmfhojnuikx/sql/new');
    console.log('\nPaste and run this SQL:\n');
    console.log(`ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(100);
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS details JSONB;`);
  } else {
    console.log('✅ Insert succeeded! Columns are now in place.');
    if (data?.[0]?.id) {
      await supabase.from('action_logs').delete().eq('id', data[0].id);
      console.log('(Test row cleaned up)');
    }
  }
}

run().catch(console.error);
