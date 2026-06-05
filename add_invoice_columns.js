import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log("Adding columns customer_email and customer_phone to public.invoices via RPC...");
  
  const sql1 = `ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);`;
  const sql2 = `ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);`;
  const sql3 = `NOTIFY pgrst, 'reload schema';`;

  const stmts = [sql1, sql2, sql3];

  for (const stmt of stmts) {
    const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });
    if (error) {
      console.error("RPC Error executing SQL:", error.message);
    } else {
      console.log(`Success executing: ${stmt}`);
    }
  }
}

run();
