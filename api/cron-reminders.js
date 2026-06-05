// api/cron-reminders.js
import pkg from 'pg';
const { Client } = pkg;
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectionString = 'postgresql://postgres:pBX5dYZR6XcYvJ1EHvzA@db.dfjxmnsozvmfhojnuikx.supabase.co:5432/postgres';

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
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for port 465, false for other ports
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
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

    // Helper function to send email
    const sendMail = async (to, subject, text, html) => {
      try {
        await transporter.sendMail({
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

    // 1. Process ad_reservations
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

    // 2. Process orders
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

    return res.status(200).json({ success: true, message: 'Cron processed successfully', emailsSent });
  } catch (err) {
    console.error('Cron job execution failed:', err);
    return res.status(500).json({ error: 'Cron processing failed', details: err.message });
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}
