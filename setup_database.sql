-- setup_database.sql
-- Run this script in the Supabase SQL Editor

-- 1. Create ad_reservations Table (Supports multiple ads per page)
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

-- 2. Drop and Recreate invoices Table with the fields matching invoicesStore.js
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
    original_invoice_id VARCHAR(50),
    email_sent_at TIMESTAMP WITH TIME ZONE
);

-- 3. Create recibos Table (Cash receipts)
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
    artwork_comment TEXT,
    email_sent_at TIMESTAMP WITH TIME ZONE
);

-- 4. Create orders Table (Pending orders)
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
    is_sequential_enabled BOOLEAN DEFAULT TRUE,
    next_invoice_number BIGINT DEFAULT 3,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pre-populate default invoice settings if not exists
INSERT INTO public.invoice_settings (id, is_sequential_enabled, next_invoice_number)
VALUES (1, TRUE, 3)
ON CONFLICT (id) DO UPDATE SET next_invoice_number = 3;

-- 6. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.ad_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

-- 7. Add Policies for Authenticated Users (Access Security)
-- ad_reservations
CREATE POLICY "Enable all actions for authenticated users on ad_reservations" 
ON public.ad_reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- invoices
CREATE POLICY "Enable all actions for authenticated users on invoices" 
ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- recibos
CREATE POLICY "Enable all actions for authenticated users on recibos" 
ON public.recibos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- orders
CREATE POLICY "Enable all actions for authenticated users on orders" 
ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- invoice_settings
CREATE POLICY "Enable all actions for authenticated users on invoice_settings" 
ON public.invoice_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Create communication_templates Table
CREATE TABLE IF NOT EXISTS public.communication_templates (
    id VARCHAR(50) PRIMARY KEY,
    subject VARCHAR(255),
    body TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and add policies
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all actions for authenticated users on communication_templates" 
ON public.communication_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Pre-populate default templates
INSERT INTO public.communication_templates (id, subject, body) VALUES
('invoice_email', 'Factura Revista Becerril: Nro. {id}', 'Hola,\n\nAdjuntamos la confirmación de pago y factura correspondiente a su anuncio en la Revista Becerril:\n\n- Número de Factura: {id}\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Método de Pago: Efectivo\n- Precio Base: {price}€\n{designPrice}- Subtotal: {subtotal}€\n- IVA (21%): {vat}€\n- Total Pagado: {total}€\n\nGracias,\nEquipo Revista Becerril'),

('invoice_whatsapp', '', 'Confirmación de pago y Factura Nro. {id} – {productAbbreviation} – {customerName} – {total}€'),

('recibo_email', 'Recibo de Pago Revista Becerril: Pág. {assignedPage}', 'Hola,\n\nConfirmamos la reserva y el recibo de pago en efectivo para su anuncio en la Revista Becerril:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Precio Base: {price}€\n{designPrice}- Recibo: {total}€\n\nGracias,\nEquipo Revista Becerril'),

('recibo_whatsapp', '', 'Recibí, pago a cuenta – {productAbbreviation} – {customerName} – {total}€'),

('order_reservation_email', 'Confirmación de Reserva Revista Becerril: Pág. {assignedPage}', 'Hola,\n\nConfirmamos la reserva del espacio publicitario en la Revista Becerril:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Método de Pago: {paymentMethod}\n- Comentarios de Arte/Diseño: {artworkComment}\n\nLa factura correspondiente se generará una vez confirmado el pago.\n\nGracias,\nEquipo Revista Becerril'),

('order_reservation_whatsapp', '', 'Confirmación de Reserva - Revista Becerril:\n\n- Cliente: {customerName}\n- Producto: {productName}\n- Pág. Asignada: {assignedPage}\n- Subtotal: {subtotal}€\n- Total (con IVA): {total}€\n\nGracias,\nEquipo Revista Becerril'),

('order_prereservation_email', 'Pre-Reserva Revista Becerril: Pág. {assignedPage}', 'Hola,\n\nConfirmamos la pre-reserva (retención de 1 semana) del espacio publicitario en la Revista Becerril:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Comentarios de Arte/Diseño: {artworkComment}\n\nNota: Esta reserva es temporal y vencerá en una semana si no se confirma el pago.\n\nGracias,\nEquipo Revista Becerril'),

('order_prereservation_whatsapp', '', 'Confirmación de Pre-reserva (temporal 1 semana) - Revista Becerril:\n\n- Cliente: {customerName}\n- Producto: {productName}\n- Pág. Asignada: {assignedPage}\n- Subtotal: {subtotal}€\n- Total (con IVA): {total}€\n\nGracias,\nEquipo Revista Becerril')
ON CONFLICT (id) DO NOTHING;
