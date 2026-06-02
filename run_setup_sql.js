// run_setup_sql.js
// Runs setup_database.sql against Supabase using the Management API

const projectRef = 'dfjxmnsozvmfhojnuikx';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';

// Full SQL to create all missing tables
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

-- 7. Drop existing policies if they exist (to avoid conflicts)
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
`;

async function run() {
  console.log('Running setup SQL against Supabase...\n');

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
  let result;
  try { result = JSON.parse(text); } catch { result = text; }

  if (!response.ok) {
    console.error('Management API failed (status', response.status, '):', result);
    console.log('\nFalling back to Supabase REST rpc approach...');
    await runViaRpc();
    return;
  }

  console.log('Success via Management API!', result);
  await verifyTables();
}

async function runViaRpc() {
  // Split SQL into individual statements and run each via the service role client
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    `https://${projectRef}.supabase.co`,
    serviceRoleKey
  );

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt });
    if (error) {
      console.error('RPC error for statement:', stmt.slice(0, 80), '\nError:', error.message);
    }
  }

  await verifyTables();
}

async function verifyTables() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    `https://${projectRef}.supabase.co`,
    serviceRoleKey
  );

  console.log('\n--- Verifying tables ---');
  for (const table of ['ad_reservations', 'invoices', 'recibos', 'orders', 'invoice_settings']) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`  ❌ ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table}: exists (${count} rows)`);
    }
  }
}

run().catch(console.error);
