import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;
import { createClient } from '@supabase/supabase-js';
import publicOtpHandler from '../api/public-otp.js';
import publicDataHandler from '../api/public-data.js';
import publicReserveHandler from '../api/public-reserve.js';


// Load environment variables from the root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper to send mail using Resend API
async function sendMailWithFallback(mailOptions) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error('Server configuration error: RESEND_API_KEY is not set');
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  let attachments = undefined;
  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    attachments = mailOptions.attachments.map(att => {
      // Strip Data URI prefix if present
      const base64Content = att.path.includes(';base64,')
        ? att.path.split(';base64,').pop()
        : att.path;
      return {
        filename: att.filename,
        content: base64Content
      };
    });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [mailOptions.to],
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html,
      attachments
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Local Server: Resend API error details:', data);
    throw new Error(`Failed to send email via Resend: ${JSON.stringify(data)}`);
  }

  return { messageId: data.id };
}

app.post('/api/send-email', async (req, res) => {
  const { to, subject, text, html, attachmentBase64, attachmentName } = req.body;

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: 'Missing required email fields (to, subject, text/html)' });
  }

  const mailOptions = {
    to,
    subject,
    text,
    html
  };

  if (attachmentBase64 && attachmentName) {
    mailOptions.attachments = [
      {
        filename: attachmentName,
        path: attachmentBase64
      }
    ];
  }

  try {
    const info = await sendMailWithFallback(mailOptions);
    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email via Resend:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

app.post('/api/upload-pdf', async (req, res) => {
  const { pdfBase64, fileName } = req.body;

  if (!pdfBase64 || !fileName) {
    return res.status(400).json({ error: 'Missing required fields (pdfBase64, fileName)' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error: Supabase keys not set' });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return res.status(500).json({ error: 'Failed to upload to storage', details: error.message });
    }

    const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(fileName);
    res.status(200).json({ success: true, url: publicUrl });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.all('/api/run-migration', async (req, res) => {
  const connectionString = 'postgresql://postgres:pBX5dYZR6XcYvJ1EHvzA@db.dfjxmnsozvmfhojnuikx.supabase.co:5432/postgres';
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    await client.query(`
      ALTER TABLE public.customers 
      ADD COLUMN IF NOT EXISTS contact_name TEXT;
    `);
    
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

    await client.query(`
      ALTER TABLE public.invoices 
      ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      ALTER TABLE public.recibos 
      ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.communication_templates (
          id VARCHAR(50) PRIMARY KEY,
          subject VARCHAR(255),
          body TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
    `).catch(() => {});

    await client.query(`
      DROP POLICY IF EXISTS "Enable all actions for authenticated users on communication_templates" ON public.communication_templates;
      CREATE POLICY "Enable all actions for authenticated users on communication_templates" 
      ON public.communication_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
    `).catch(() => {});

    await client.query(`
      INSERT INTO public.communication_templates (id, subject, body) VALUES
      ('invoice_email', 'Factura Revista de Fiestas Patronales Becerril de la Sierra 2026: Nro. {id}', 'Hola,\n\nAdjuntamos la confirmación de pago y factura correspondiente a su anuncio en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Número de Factura: {id}\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Método de Pago: {paymentMethod}\n- Precio Base: {price}€\n{designPrice}- Subtotal: {subtotal}€\n- IVA (21%): {vat}€\n- Total Pagado: {total}€\n\nFORMA de PAGO: TRANSFERENCIA a IBAN: ES0600492246812214008717   / REFEFERENCIA PAGO: {id}\n\nGracias,\nEquipo de Coordinación Publicitaria'),

      ('invoice_whatsapp', '', 'Confirmación de pago y Factura Nro. {id} – {productAbbreviation} – {customerName} – {total}€'),

      ('recibo_email', 'Recibo de Pago Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}', 'Hola,\n\nConfirmamos la reserva y el recibo de pago en efectivo para su anuncio en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Precio Base: {price}€\n{designPrice}- Recibo: {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'),

      ('recibo_whatsapp', '', 'Recibí, pago a cuenta – {productAbbreviation} – {customerName} – {total}€'),

      ('order_reservation_email', 'Confirmación de Reserva Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}', 'Hola,\n\nConfirmamos la reserva del espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Método de Pago: {paymentMethod}\n- Comentarios de Arte/Diseño: {artworkComment}\n\nFORMA de PAGO: TRANSFERENCIA a IBAN: ES0600492246812214008717   / REFEFERENCIA PAGO: {productName}\n\nLa factura correspondiente se generará una vez confirmado el pago.\n\nGracias,\nEquipo de Coordinación Publicitaria'),

      ('order_reservation_whatsapp', '', 'Confirmación de Reserva - Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Cliente: {customerName}\n- Producto: {productName}\n- Pág. Asignada: {assignedPage}\n- Subtotal: {subtotal}€\n- Total (con IVA): {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'),

      ('order_prereservation_email', 'Pre-Reserva Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}', 'Hola,\n\nConfirmamos la pre-reserva (retención de 1 semana) del espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Comentarios de Arte/Diseño: {artworkComment}\n\nNota: Esta reserva es temporal y vencerá en una semana si no se confirma el pago.\n\nGracias,\nEquipo de Coordinación Publicitaria'),

      ('order_prereservation_whatsapp', '', 'Confirmación de Pre-reserva (temporal 1 semana) - Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Cliente: {customerName}\n- Producto: {productName}\n- Pág. Asignada: {assignedPage}\n- Subtotal: {subtotal}€\n- Total (con IVA): {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria')
      ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body;
    `);

    res.status(200).json({ success: true, message: 'Database migrated successfully!' });
  } catch (err) {
    console.error('Migration failed:', err);
    res.status(500).json({ error: 'Migration failed', details: err.message });
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
});

app.all('/api/cron-reminders', async (req, res) => {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const appUrl = process.env.VITE_APP_URL || req.headers.referer || 'http://localhost:5173';

  try {
    await client.connect();
    
    // Fetch all active pre-reservations from ad_reservations
    const adRes = await client.query(`
      SELECT ar.*, c.email as customer_email, c.commercial_name, c.fiscal_name
      FROM public.ad_reservations ar
      LEFT JOIN public.customers c ON ar.customer_id = c.id OR ar.customer_id = c.nif
      WHERE ar.is_pre_reserved = true
    `);

    // Fetch all active pre-reservations from orders table
    const orderRes = await client.query(`
      SELECT * FROM public.orders
      WHERE order_type = 'pre-reserved' AND is_paid = false
    `);

    const now = new Date();
    const emailsSent = [];

    const getHtmlTemplate = (title, content, buttonText = '', buttonUrl = '') => {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
              background-color: #f8fafc;
              margin: 0;
              padding: 0;
              -webkit-font-smoothing: antialiased;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            }
            .header {
              background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
              padding: 32px;
              text-align: center;
            }
            .header h1 {
              color: #ffffff;
              font-size: 24px;
              font-weight: 700;
              margin: 0;
            }
            .content {
              padding: 32px;
              color: #334155;
              line-height: 1.6;
              font-size: 15px;
            }
            .content p {
              margin-top: 0;
              margin-bottom: 16px;
            }
            .button-container {
              text-align: center;
              margin: 32px 0;
            }
            .button {
              background-color: #3b82f6;
              color: #ffffff !important;
              text-decoration: none;
              padding: 12px 28px;
              font-size: 14px;
              font-weight: 600;
              border-radius: 8px;
              display: inline-block;
            }
            .footer {
              background-color: #f1f5f9;
              padding: 24px;
              text-align: center;
              font-size: 12px;
              color: #64748b;
              border-top: 1px solid #e2e8f0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; color: #ffffff;">Revista de Fiestas Patronales Becerril de la Sierra 2026</h1>
            </div>
            <div class="content">
              <h2 style="color: #0f172a; font-size: 18px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">${title}</h2>
              ${content}
              ${buttonText && buttonUrl ? `
                <div class="button-container">
                  <a href="${buttonUrl}" class="button">${buttonText}</a>
                </div>
              ` : ''}
            </div>
            <div class="footer">
              <p style="margin: 0;">Este es un correo automático de Revista de Fiestas Patronales Becerril de la Sierra 2026.</p>
              <p style="margin: 4px 0 0 0;">I am your granny S.L. &bull; &copy; 2026 Revista de Fiestas Patronales Becerril de la Sierra 2026. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    };

    const sendMail = async (to, subject, text, html) => {
      try {
        await sendMailWithFallback({
          from: process.env.GMAIL_USER,
          to,
          subject,
          text,
          html
        });
        emailsSent.push({ to, subject });
        console.log(`Sent email to ${to}: ${subject}`);
      } catch (err) {
        console.error(`Failed to send email to ${to}:`, err);
      }
    };

    // Process ad_reservations
    for (const row of adRes.rows) {
      const createdDate = new Date(row.created_at || now);
      const d1 = new Date(createdDate);
      const d2 = new Date(now);
      d1.setHours(0, 0, 0, 0);
      d2.setHours(0, 0, 0, 0);
      const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      const email = row.customer_email;
      const name = row.customer_name || row.commercial_name || row.fiscal_name || 'Cliente';
      const lastDay = row.last_auto_reminder_day || 0;

      if (!email) continue;

      if (diffDays >= 1 && diffDays <= 5 && lastDay < diffDays) {
        const remainingDays = 7 - diffDays;
        const subject = `Recordatorio de Reserva: Pág. ${row.page_number} - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
        const html = getHtmlTemplate(
          `Recordatorio de Reserva (Pág. ${row.page_number})`,
          `<p>Hola <strong>${name}</strong>,</p>
           <p>Le recordamos que su espacio publicitario (Pág. ${row.page_number}) está pre-reservado y pendiente de pago.</p>
           <p>Tiene <strong>${remainingDays} días restantes</strong> para confirmar y pagar su reserva antes de que venza.</p>
           <p>Por favor, realice una transferencia bancaria para asegurar su espacio.</p>`
        );
        const text = `Hola ${name},\n\nLe recordamos que su espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026 (Pág. ${row.page_number}) está pre-reservado y pendiente de pago.\n\nTiene ${remainingDays} días restantes.\n\nGracias,\nEquipo de Coordinación Publicitaria`;
        await sendMail(email, subject, text, html);
        await client.query(`UPDATE public.ad_reservations SET last_auto_reminder_day = $1 WHERE id = $2`, [diffDays, row.id]);
      } else if (diffDays === 6 && lastDay < 6) {
        const subject = `¡Último aviso! Su reserva de la Pág. ${row.page_number} vencerá mañana - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
        const html = getHtmlTemplate(
          `¡Último aviso! Vence mañana`,
          `<p>Hola <strong>${name}</strong>,</p>
           <p style="color: #e11d48; font-weight: 600;">Este es un recordatorio importante de que su pre-reserva para la página ${row.page_number} vencerá y se cancelará mañana.</p>
           <p>Le queda <strong>1 día restante</strong> para confirmar y realizar el pago para asegurar su espacio.</p>`
        );
        const text = `Hola ${name},\n\nEste es un recordatorio importante de que su pre-reserva de la página ${row.page_number} vencerá y se cancelará mañana (le queda 1 día restante).\n\nGracias,\nEquipo de Coordinación Publicitaria`;
        await sendMail(email, subject, text, html);
        await client.query(`UPDATE public.ad_reservations SET last_auto_reminder_day = 6 WHERE id = $1`, [row.id]);
      } else if (diffDays >= 7) {
        if (now.getHours() < 12 && lastDay < 7) {
          const subject = `Acción requerida: Reserva Pág. ${row.page_number} se cancelará hoy a las 12:00 PM`;
          const confirmLink = `${appUrl.split('?')[0]}?confirm_reservation_id=${row.id}&type=ad`;
          const html = getHtmlTemplate(
            `Acción Requerida: Vence hoy a las 12:00 PM`,
            `<p>Hola <strong>${name}</strong>,</p>
             <p>Su pre-reserva para la página ${row.page_number} vence hoy. Tiene hasta las <strong>12:00 PM de hoy (0 días restantes)</strong>, después de lo cual el sistema la cancelará automáticamente y liberará el espacio.</p>
             <p>Por favor, utilice el siguiente botón para indicar si desea comprar el anuncio (haciendo transferencia), solicitar una prolongación temporal (máx. 3 días) o cancelar la pre-reserva.</p>`,
            'Gestionar mi Pre-reserva',
            confirmLink
          );
          const text = `Hola ${name},\n\nTiene hasta las 12:00 PM de hoy para confirmar su reserva de la página ${row.page_number}. Después de esta hora, se cancelará automáticamente.\n\nGestione su reserva en:\n${confirmLink}`;
          await sendMail(email, subject, text, html);
          await client.query(`UPDATE public.ad_reservations SET last_auto_reminder_day = 7 WHERE id = $1`, [row.id]);
        } else if (now.getHours() >= 12) {
          await client.query(`DELETE FROM public.ad_reservations WHERE id = $1`, [row.id]);
          const subject = `Pre-reserva Cancelada: Pág. ${row.page_number} - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
          const html = getHtmlTemplate(
            `Pre-reserva Cancelada Automáticamente`,
            `<p>Hola <strong>${name}</strong>,</p>
             <p>Lamentamos informarle que su pre-reserva para la página ${row.page_number} ha vencido hoy a las 12:00 PM sin confirmación de pago.</p>
             <p>El espacio publicitario ha sido liberado para otros clientes.</p>`
          );
          const text = `Hola ${name},\n\nLamentamos informarle que su pre-reserva para la página ${row.page_number} ha vencido hoy y ha sido cancelada automáticamente.\n\nGracias,\nEquipo de Coordinación Publicitaria`;
          await sendMail(email, subject, text, html);
        }
      }
    }

    // Process orders
    for (const row of orderRes.rows) {
      const createdDate = new Date(row.created_at || now);
      const d1 = new Date(createdDate);
      const d2 = new Date(now);
      d1.setHours(0, 0, 0, 0);
      d2.setHours(0, 0, 0, 0);
      const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      const email = row.customer_email;
      const name = row.customer_name || 'Cliente';
      const lastDay = row.last_auto_reminder_day || 0;

      if (!email) continue;

      if (diffDays >= 1 && diffDays <= 5 && lastDay < diffDays) {
        const remainingDays = 7 - diffDays;
        const subject = `Recordatorio de Reserva: Pág. ${row.assigned_page} - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
        const html = getHtmlTemplate(
          `Recordatorio de Reserva (Pág. ${row.assigned_page})`,
          `<p>Hola <strong>${name}</strong>,</p>
           <p>Le recordamos que su espacio publicitario (Pág. ${row.assigned_page}) está pre-reservado y pendiente de pago.</p>
           <p>Tiene <strong>${remainingDays} días restantes</strong> para confirmar y pagar su reserva antes de que venza.</p>
           <p>Por favor, realice una transferencia bancaria para asegurar su espacio.</p>`
        );
        const text = `Hola ${name},\n\nLe recordamos que su espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026 (Pág. ${row.assigned_page}) está pre-reservado y pendiente de pago.\n\nTiene ${remainingDays} días restantes.\n\nGracias,\nEquipo de Coordinación Publicitaria`;
        await sendMail(email, subject, text, html);
        await client.query(`UPDATE public.orders SET last_auto_reminder_day = $1 WHERE id = $2`, [diffDays, row.id]);
      } else if (diffDays === 6 && lastDay < 6) {
        const subject = `¡Último aviso! Su reserva de la Pág. ${row.assigned_page} vencerá mañana - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
        const html = getHtmlTemplate(
          `¡Último aviso! Vence mañana`,
          `<p>Hola <strong>${name}</strong>,</p>
           <p style="color: #e11d48; font-weight: 600;">Este es un recordatorio importante de que su pre-reserva para la página ${row.assigned_page} vencerá y se cancelará mañana.</p>
           <p>Le queda <strong>1 día restante</strong> para confirmar y realizar el pago para asegurar su espacio.</p>`
        );
        const text = `Hola ${name},\n\nEste es un recordatorio importante de que su pre-reserva de la página ${row.assigned_page} vencerá y se cancelará mañana (le queda 1 día restante).\n\nGracias,\nEquipo de Coordinación Publicitaria`;
        await sendMail(email, subject, text, html);
        await client.query(`UPDATE public.orders SET last_auto_reminder_day = 6 WHERE id = $1`, [row.id]);
      } else if (diffDays >= 7) {
        if (now.getHours() < 12 && lastDay < 7) {
          const subject = `Acción requerida: Reserva Pág. ${row.assigned_page} se cancelará hoy a las 12:00 PM`;
          const confirmLink = `${appUrl.split('?')[0]}?confirm_reservation_id=${row.id}&type=order`;
          const html = getHtmlTemplate(
            `Acción Requerida: Vence hoy a las 12:00 PM`,
            `<p>Hola <strong>${name}</strong>,</p>
             <p>Su pre-reserva para la página ${row.assigned_page} vence hoy. Tiene hasta las <strong>12:00 PM de hoy (0 días restantes)</strong>, después de lo cual el sistema la cancelará automáticamente y liberará el espacio.</p>
             <p>Por favor, utilice el siguiente botón para indicar si desea comprar el anuncio (haciendo transferencia), solicitar una prolongación temporal (máx. 3 días) o cancelar la pre-reserva.</p>`,
            'Gestionar mi Pre-reserva',
            confirmLink
          );
          const text = `Hola ${name},\n\nTiene hasta las 12:00 PM de hoy para confirmar su reserva de la página ${row.assigned_page}. Después de esta hora, se cancelará automáticamente.\n\nGestione su reserva en:\n${confirmLink}`;
          await sendMail(email, subject, text, html);
          await client.query(`UPDATE public.orders SET last_auto_reminder_day = 7 WHERE id = $1`, [row.id]);
        } else if (now.getHours() >= 12) {
          await client.query(`DELETE FROM public.orders WHERE id = $1`, [row.id]);
          const subject = `Pre-reserva Cancelada: Pág. ${row.assigned_page} - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
          const html = getHtmlTemplate(
            `Pre-reserva Cancelada Automáticamente`,
            `<p>Hola <strong>${name}</strong>,</p>
             <p>Lamentamos informarle que su pre-reserva para la página ${row.assigned_page} ha vencido hoy a las 12:00 PM sin confirmación de pago.</p>
             <p>El espacio publicitario ha sido liberado para otros clientes.</p>`
          );
          const text = `Hola ${name},\n\nLamentamos informarle que su pre-reserva para la página ${row.assigned_page} ha vencido hoy y ha sido cancelada automáticamente.\n\nGracias,\nEquipo de Coordinación Publicitaria`;
          await sendMail(email, subject, text, html);
        }
      }
    }

    res.status(200).json({ success: true, message: 'Cron processed successfully', emailsSent });
  } catch (err) {
    console.error('Cron job execution failed:', err);
    res.status(500).json({ error: 'Cron processing failed', details: err.message });
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
});

app.post('/api/public-otp', publicOtpHandler);
app.get('/api/public-data', publicDataHandler);
app.post('/api/public-reserve', publicReserveHandler);

app.listen(PORT, () => {
  console.log(`Email backend server running on http://localhost:${PORT}`);
});
