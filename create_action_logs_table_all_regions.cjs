// create_action_logs_table_all_regions.cjs
const { Client } = require('pg');
const { Resolver } = require('dns');

const resolver = new Resolver();
resolver.setServers(['8.8.8.8', '8.8.4.4']);

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

function resolveDns(host) {
  return new Promise((resolve) => {
    resolver.resolve4(host, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        resolve(null);
      } else {
        resolve(addresses[0]);
      }
    });
  });
}

async function run() {
  console.log('Resolving and testing database poolers in all regions...');

  for (const region of regions) {
    const domain = `aws-0-${region}.pooler.supabase.com`;
    process.stdout.write(`Trying ${region} (${domain})... `);
    
    const ip = await resolveDns(domain);
    if (!ip) {
      console.log('DNS resolution failed');
      continue;
    }

    const client = new Client({
      user: 'postgres.dfjxmnsozvmfhojnuikx',
      password: 'pBX5dYZR6XcYvJ1EHvzA',
      host: ip,
      port: 6543,
      database: 'postgres',
      ssl: { rejectUnauthorized: false, servername: domain },
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      console.log(`Connected successfully using IP ${ip}!`);
      
      console.log('Executing SQL to create action_logs...');
      await client.query(sql);
      console.log('✅ Columns/Table created successfully!');
      
      await client.end();
      return; // Exit script since we found the correct region and finished
    } catch (err) {
      console.log(`connection failed: ${err.message}`);
      try { await client.end(); } catch (e) {}
    }
  }

  console.error('\nCould not connect to any region pooler IPv4!');
  process.exit(1);
}

run();
