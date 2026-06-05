// fix_action_logs_pg.cjs
// Uses direct Postgres connection to recreate action_logs with full schema
const { Client } = require('pg');

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
    return client;
  } catch (err) {
    try { await client.end(); } catch (e) {}
    return null;
  }
}

async function run() {
  console.log('Connecting to Supabase Postgres...');
  let client = null;
  for (const region of regions) {
    process.stdout.write(`  Trying ${region}... `);
    client = await tryRegion(region);
    if (client) {
      console.log('✅ Connected!');
      break;
    }
    console.log('❌');
  }

  if (!client) {
    console.error('\nCould not connect to any region!');
    process.exit(1);
  }

  try {
    // Step 1: Check current columns
    console.log('\nChecking current action_logs columns...');
    const colRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='action_logs' 
      ORDER BY ordinal_position;
    `);
    
    if (colRes.rows.length === 0) {
      console.log('Table does not exist yet, will create it.');
    } else {
      console.log('Current columns:', colRes.rows.map(r => r.column_name).join(', '));
    }

    // Step 2: Drop and recreate with full schema
    console.log('\nRecreating action_logs with full schema...');
    
    await client.query('DROP TABLE IF EXISTS public.action_logs;');
    console.log('  ✅ Old table dropped');
    
    await client.query(`
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
    `);
    console.log('  ✅ New table created with full schema');

    // Step 3: Enable RLS
    await client.query('ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;');
    console.log('  ✅ RLS enabled');

    // Step 4: Create policy
    await client.query(`
      DROP POLICY IF EXISTS "Enable all actions for authenticated users on action_logs" ON public.action_logs;
    `);
    await client.query(`
      CREATE POLICY "Enable all actions for authenticated users on action_logs"
      ON public.action_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
    `);
    console.log('  ✅ RLS policy created');

    // Step 5: Add to realtime publication
    try {
      await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'action_logs'
            ) THEN
                ALTER PUBLICATION supabase_realtime ADD TABLE public.action_logs;
            END IF;
        END $$;
      `);
      console.log('  ✅ Added to realtime publication');
    } catch (e) {
      console.log('  ⚠️  Realtime publication (non-critical):', e.message);
    }

    // Step 6: Verify final schema
    console.log('\nFinal column list:');
    const finalCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='action_logs' 
      ORDER BY ordinal_position;
    `);
    finalCols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

    console.log('\n✅ action_logs table successfully recreated with full schema!');
    console.log('\nThe app should now log all events to Supabase correctly.');

  } catch (err) {
    console.error('\n❌ Failed:', err.message);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
