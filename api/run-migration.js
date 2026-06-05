// api/run-migration.js
import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres.dfjxmnsozvmfhojnuikx:pBX5dYZR6XcYvJ1EHvzA@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = new Client({
    user: 'postgres.dfjxmnsozvmfhojnuikx',
    password: 'pBX5dYZR6XcYvJ1EHvzA',
    host: 'aws-0-eu-west-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // 1. Alter ad_reservations
    await client.query(`
      ALTER TABLE public.ad_reservations 
      ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      ALTER TABLE public.ad_reservations 
      ADD COLUMN IF NOT EXISTS email_reminder_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      ALTER TABLE public.ad_reservations 
      ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      ALTER TABLE public.ad_reservations 
      ADD COLUMN IF NOT EXISTS email_reminders_count INT DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE public.ad_reservations 
      ADD COLUMN IF NOT EXISTS whatsapp_reminders_count INT DEFAULT 0;
    `);

    // 2. Alter orders
    await client.query(`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS email_reminder_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS email_reminders_count INT DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS whatsapp_reminders_count INT DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE public.ad_reservations 
      ADD COLUMN IF NOT EXISTS last_auto_reminder_day INT DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE public.ad_reservations 
      ADD COLUMN IF NOT EXISTS prolonged_count INT DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS last_auto_reminder_day INT DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS prolonged_count INT DEFAULT 0;
    `);

    // 3. Alter invoices
    await client.query(`
      ALTER TABLE public.invoices 
      ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    // 4. Alter recibos
    await client.query(`
      ALTER TABLE public.recibos 
      ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    // 5. Create communication_templates
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.communication_templates (
          id VARCHAR(50) PRIMARY KEY,
          subject VARCHAR(255),
          body TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 6. Enable RLS and add policies
    await client.query(`
      ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
    `).catch(() => {});

    await client.query(`
      DROP POLICY IF EXISTS "Enable all actions for authenticated users on communication_templates" ON public.communication_templates;
      CREATE POLICY "Enable all actions for authenticated users on communication_templates" 
      ON public.communication_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
    `).catch(() => {});

    // 7. Insert default templates
    await client.query(`
      INSERT INTO public.communication_templates (id, subject, body) VALUES
      ('invoice_email', 'Factura Revista de Fiestas Patronales Becerril de la Sierra 2026: Nro. {id}', 'Hola,\n\nAdjuntamos la confirmación de pago y factura correspondiente a su anuncio en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Número de Factura: {id}\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Método de Pago: Efectivo\n- Precio Base: {price}€\n{designPrice}- Subtotal: {subtotal}€\n- IVA (21%): {vat}€\n- Total Pagado: {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'),

      ('invoice_whatsapp', '', 'Confirmación de pago y Factura Nro. {id} – {productAbbreviation} – {customerName} – {total}€'),

      ('recibo_email', 'Recibo de Pago Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}', 'Hola,\n\nConfirmamos la reserva y el recibo de pago en efectivo para su anuncio en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Precio Base: {price}€\n{designPrice}- Recibo: {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'),

      ('recibo_whatsapp', '', 'Recibí, pago a cuenta – {productAbbreviation} – {customerName} – {total}€'),

      ('order_reservation_email', 'Confirmación de Reserva Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}', 'Hola,\n\nConfirmamos la reserva del espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Método de Pago: {paymentMethod}\n- Comentarios de Arte/Diseño: {artworkComment}\n\nLa factura correspondiente se generará una vez confirmado el pago.\n\nGracias,\nEquipo de Coordinación Publicitaria'),

      ('order_reservation_whatsapp', '', 'Confirmación de Reserva - Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Cliente: {customerName}\n- Producto: {productName}\n- Pág. Asignada: {assignedPage}\n- Subtotal: {subtotal}€\n- Total (con IVA): {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'),

      ('order_prereservation_email', 'Pre-Reserva Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}', 'Hola,\n\nConfirmamos la pre-reserva (retención de 1 semana) del espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Comentarios de Arte/Diseño: {artworkComment}\n\nNota: Esta reserva es temporal y vencerá en una semana si no se confirma el pago.\n\nGracias,\nEquipo de Coordinación Publicitaria'),

      ('order_prereservation_whatsapp', '', 'Confirmación de Pre-reserva (temporal 1 semana) - Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Cliente: {customerName}\n- Producto: {productName}\n- Pág. Asignada: {assignedPage}\n- Subtotal: {subtotal}€\n- Total (con IVA): {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 8. Create action_logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.action_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          action_type VARCHAR(100) NOT NULL,
          target_id VARCHAR(100),
          customer_name VARCHAR(255),
          customer_phone VARCHAR(100),
          customer_email VARCHAR(255),
          product_name VARCHAR(255),
          page_number INT,
          price NUMERIC DEFAULT 0,
          design_price NUMERIC DEFAULT 0,
          vat NUMERIC DEFAULT 0,
          total NUMERIC DEFAULT 0,
          payment_method VARCHAR(100),
          payment_status VARCHAR(100),
          details JSONB
      );
    `);

    await client.query(`
      ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;
    `).catch(() => {});

    await client.query(`
      DROP POLICY IF EXISTS "Enable all actions for authenticated users on action_logs" ON public.action_logs;
      CREATE POLICY "Enable all actions for authenticated users on action_logs" 
      ON public.action_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
    `).catch(() => {});

    await client.query(`
      DROP POLICY IF EXISTS "Enable all actions for anon users on action_logs" ON public.action_logs;
      CREATE POLICY "Enable all actions for anon users on action_logs" 
      ON public.action_logs FOR ALL TO anon USING (true) WITH CHECK (true);
    `).catch(() => {});

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
    `).catch(() => {});

    return res.status(200).json({ success: true, message: 'Database migrated successfully!' });
  } catch (err) {
    console.error('Migration failed:', err);
    return res.status(500).json({ error: 'Migration failed', details: err.message });
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}
