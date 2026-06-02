const { Client } = require('pg');
const fs = require('fs');

const sql = `
-- 1. Create ad_reservations Table
CREATE TABLE IF NOT EXISTS public.ad_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_number INT NOT NULL REFERENCES public.magazine_pages(page_number) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    ad_type TEXT NOT NULL,
    is_pre_reserved BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    artwork_option TEXT,
    design_work_option TEXT,
    design_work_price NUMERIC DEFAULT 0,
    is_paid BOOLEAN DEFAULT FALSE,
    payment_method TEXT DEFAULT 'Transfer',
    is_new BOOLEAN DEFAULT TRUE,
    is_recibo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Drop and Recreate invoices Table
DROP TABLE IF EXISTS public.invoices CASCADE;
CREATE TABLE public.invoices (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'Active',
    payment_method VARCHAR(50) DEFAULT 'Pending',
    is_paid BOOLEAN DEFAULT FALSE,
    customer_name VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    price NUMERIC DEFAULT 0,
    design_price NUMERIC DEFAULT 0,
    vat NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    assigned_page INT REFERENCES public.magazine_pages(page_number) ON DELETE SET NULL,
    artwork_comment TEXT,
    original_invoice_id VARCHAR(50)
);

-- 3. Create recibos Table
CREATE TABLE IF NOT EXISTS public.recibos (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'Active',
    payment_method VARCHAR(50) DEFAULT 'Cash',
    is_paid BOOLEAN DEFAULT TRUE,
    is_recibo BOOLEAN DEFAULT TRUE,
    customer_name VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    price NUMERIC DEFAULT 0,
    design_price NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    assigned_page INT REFERENCES public.magazine_pages(page_number) ON DELETE SET NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    artwork_comment TEXT
);

-- 4. Create orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'Pending',
    is_paid BOOLEAN DEFAULT FALSE,
    payment_method VARCHAR(50) DEFAULT 'Transfer',
    customer_name VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    price NUMERIC DEFAULT 0,
    design_price NUMERIC DEFAULT 0,
    assigned_page INT REFERENCES public.magazine_pages(page_number) ON DELETE SET NULL,
    artwork_comment TEXT,
    order_type VARCHAR(50) DEFAULT 'transfer',
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50)
);

-- 5. Create invoice_settings Table
CREATE TABLE IF NOT EXISTS public.invoice_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    is_sequential_enabled BOOLEAN DEFAULT FALSE,
    next_invoice_number BIGINT DEFAULT 2026060201,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
INSERT INTO public.invoice_settings (id, is_sequential_enabled, next_invoice_number)
VALUES (1, FALSE, 2026060201)
ON CONFLICT (id) DO NOTHING;

-- 6. Enable Row Level Security
ALTER TABLE public.ad_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

-- 7. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable all actions for authenticated users on ad_reservations" ON public.ad_reservations;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on invoices" ON public.invoices;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on recibos" ON public.recibos;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on orders" ON public.orders;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on invoice_settings" ON public.invoice_settings;

-- 8. Create RLS Policies
CREATE POLICY "Enable all actions for authenticated users on ad_reservations"
  ON public.ad_reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on invoices"
  ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on recibos"
  ON public.recibos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on orders"
  ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for authenticated users on invoice_settings"
  ON public.invoice_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Grant schema visibility to PostgREST roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
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
    return null;
  }
}

async function run() {
  let client = null;

  for (const region of regions) {
    process.stdout.write(`Trying ${region}... `);
    client = await tryRegion(region);
    if (client) { console.log('OK'); break; }
    console.log('failed');
  }

  if (!client) {
    console.error('Could not connect to any region!');
    process.exit(1);
  }

  try {
    console.log('\nRunning setup SQL...');
    await client.query(sql);
    console.log('✅ All tables created successfully!');

    // Verify
    console.log('\n--- Verifying tables ---');
    const tables = ['ad_reservations', 'invoices', 'recibos', 'orders', 'invoice_settings'];
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM public.${table}`);
      console.log(`  ✅ ${table}: exists (${res.rows[0].count} rows)`);
    }
  } catch (err) {
    console.error('Error running SQL:', err.message);
    console.error(err.detail || '');
  } finally {
    await client.end();
  }
}

run();
