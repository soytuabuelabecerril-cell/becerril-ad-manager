// create_action_logs_table_direct.cjs
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:pBX5dYZR6XcYvJ1EHvzA@db.dfjxmnsozvmfhojnuikx.supabase.co:5432/postgres';

const sql = `
-- Create action_logs Table
CREATE TABLE IF NOT EXISTS public.action_logs (
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
);

-- Enable RLS
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Enable all actions for authenticated users on action_logs" ON public.action_logs;

-- Create policy
CREATE POLICY "Enable all actions for authenticated users on action_logs"
ON public.action_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Check if we can add to realtime publication
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
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to database directly.");

    console.log('Running migration SQL to create action_logs table...');
    await client.query(sql);
    console.log('✅ action_logs table created successfully!');
  } catch (err) {
    console.error('Error running SQL:', err.message);
  } finally {
    await client.end();
  }
}

run();
