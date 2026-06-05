// create_action_logs_table_rpc.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, serviceRoleKey);

const sqlStatements = [
  `CREATE TABLE IF NOT EXISTS public.action_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      action_type VARCHAR(100) NOT NULL,
      target_id VARCHAR(100),
      customer_name VARCHAR(255),
      product_name VARCHAR(255),
      page_number INT,
      price NUMERIC DEFAULT 0,
      design_price NUMERIC DEFAULT 0,
      vat NUMERIC DEFAULT 0,
      total NUMERIC DEFAULT 0,
      payment_method VARCHAR(50),
      is_paid BOOLEAN DEFAULT FALSE,
      details TEXT
  )`,
  `ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Enable all actions for authenticated users on action_logs" ON public.action_logs`,
  `CREATE POLICY "Enable all actions for authenticated users on action_logs" ON public.action_logs FOR ALL TO authenticated USING (true) WITH CHECK (true)`,
  `DO $$
  BEGIN
      IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables 
          WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'action_logs'
      ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.action_logs;
      END IF;
  END $$;`
];

async function run() {
  console.log("Running SQL queries via Supabase RPC exec_sql...");
  for (const stmt of sqlStatements) {
    console.log(`Executing statement: ${stmt.substring(0, 60)}...`);
    const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });
    if (error) {
      console.error("RPC Error:", error.message);
    } else {
      console.log("Success!");
    }
  }
}

run().catch(console.error);
