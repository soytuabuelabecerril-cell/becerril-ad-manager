// recreate_action_logs.mjs
// Drops and recreates action_logs with the FULL correct schema
const projectRef = 'dfjxmnsozvmfhojnuikx';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

// The CORRECT full schema that matches what logAction() inserts
const sql = `
-- Drop and recreate action_logs with full schema
DROP TABLE IF EXISTS public.action_logs;

CREATE TABLE public.action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action_type VARCHAR(100) NOT NULL,
    target_id VARCHAR(100),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(100),
    product_name VARCHAR(255),
    page_number INT,
    price NUMERIC DEFAULT 0,
    design_price NUMERIC DEFAULT 0,
    vat NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    payment_method VARCHAR(50),
    is_paid BOOLEAN DEFAULT FALSE,
    payment_status VARCHAR(50),
    details JSONB
);

-- Enable RLS
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to do everything
DROP POLICY IF EXISTS "Enable all actions for authenticated users on action_logs" ON public.action_logs;
CREATE POLICY "Enable all actions for authenticated users on action_logs"
ON public.action_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add to realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'action_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.action_logs;
    END IF;
END $$;
`;

async function run() {
  console.log('Recreating action_logs table with full schema...\n');

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const text = await response.text();
  console.log('HTTP Status:', response.status);
  console.log('Response:', text);

  if (response.ok || response.status === 200 || response.status === 201) {
    console.log('\n✅ Table recreated successfully!');
  } else {
    console.log('\n❌ Management API failed (status', response.status, ')');
    console.log('\n⚠️  Please run the following SQL manually in Supabase Dashboard > SQL Editor:');
    console.log(sql);
  }
}

run().catch(console.error);
