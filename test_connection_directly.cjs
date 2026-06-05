// test_connection_directly.cjs
const { Client } = require('pg');

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

const regions = [
  'eu-central-1', 'eu-west-3', 'eu-west-1', 'eu-west-2', 'eu-north-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1', 'ap-southeast-1', 'ap-southeast-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-south-1', 'sa-east-1'
];

async function tryRegion(region) {
  const client = new Client({
    user: 'postgres.dfjxmnsozvmfhojnuikx',
    password: 'pBX5dYZR6XcYvJ1EHvzA',
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    await client.connect();
    console.log(`Connected via region: ${region}`);
    return client;
  } catch (err) {
    try { await client.end(); } catch (e) {}
    console.log(`Region ${region} failed: ${err.message}`);
    return null;
  }
}

async function run() {
  let client = null;

  for (const region of regions) {
    process.stdout.write(`Trying ${region}... `);
    client = await tryRegion(region);
    if (client) { console.log('OK'); break; }
  }

  if (!client) {
    console.error('Could not connect to any region!');
    process.exit(1);
  }

  try {
    console.log('\nRunning migration SQL to create action_logs table...');
    await client.query(sql);
    console.log('✅ action_logs table created successfully!');
  } catch (err) {
    console.error('Error running SQL:', err.message);
  } finally {
    await client.end();
  }
}

run();
