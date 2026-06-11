import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error: Supabase keys not set' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { action } = req.body;

  if (action === 'send') {
    const { businessName } = req.body;
    if (!businessName) {
      return res.status(400).json({ error: 'Falta el nombre comercial o fiscal del negocio.' });
    }

    try {
      // Look up customer (case-insensitive)
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('id, email, whatsapp, commercial_name, fiscal_name')
        .or(`commercial_name.ilike."${businessName.trim()}",fiscal_name.ilike."${businessName.trim()}"`)
        .limit(1)
        .maybeSingle();

      if (custErr) throw custErr;

      if (!customer) {
        return res.status(404).json({ error: 'Negocio no encontrado. Por favor, asegúrese de que el nombre coincide con el registrado.' });
      }

      if (!customer.email) {
        return res.status(400).json({ error: 'El negocio no tiene un correo electrónico registrado para recibir el código. Por favor, contacte al administrador.' });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 15 * 60 * 1000; // 15 mins
      
      // Hash code statelessly
      const dataToSign = `${customer.id}|${otp}|${expires}`;
      const hash = crypto.createHmac('sha256', serviceKey).update(dataToSign).digest('hex');
      const token = `${hash}.${expires}`;

      // Send email
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        return res.status(500).json({ error: 'RESEND_API_KEY is not configured on the server.' });
      }
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

      const emailSubject = `Código de verificación: ${otp} - Revista Becerril 2026`;
      const emailText = `Hola,\n\nSu código de verificación para realizar la reserva es: ${otp}\n\nEste código caducará en 15 minutos.\n\nSi no ha solicitado este código, por favor ignore este mensaje.\n\nEquipo de Revista Becerril 2026`;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #1e3a8a; margin-top: 0;">Verificación de Reserva</h2>
          <p>Hola,</p>
          <p>Ha solicitado realizar una reserva en la <strong>Revista de Fiestas Patronales Becerril de la Sierra 2026</strong>.</p>
          <p>Su código de verificación es:</p>
          <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #1e293b; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 14px;">Este código caducará en 15 minutos.</p>
          <p style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #94a3b8; margin-top: 30px;">
            Si usted no solicitó este código, por favor ignore este mensaje.
          </p>
        </div>
      `;

      const mailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [customer.email],
          subject: emailSubject,
          text: emailText,
          html: emailHtml
        })
      });

      const mailData = await mailRes.json();
      if (!mailRes.ok) {
        console.error('Failed to send verification email:', mailData);
        return res.status(500).json({ error: 'Error al enviar el correo electrónico con el código.' });
      }

      // Mask email for privacy
      const maskEmail = (email) => {
        const [name, domain] = email.split('@');
        if (name.length <= 2) return `${name[0]}***@${domain}`;
        return `${name.substring(0, 2)}***${name.substring(name.length - 1)}@${domain}`;
      };

      return res.status(200).json({
        success: true,
        token,
        customerId: customer.id,
        email: maskEmail(customer.email)
      });
    } catch (err) {
      console.error('Send OTP error:', err);
      return res.status(500).json({ error: 'Error interno del servidor.', details: err.message });
    }
  } 
  
  if (action === 'verify') {
    const { customerId, otp, token } = req.body;
    if (!customerId || !otp || !token) {
      return res.status(400).json({ error: 'Faltan parámetros obligatorios (customerId, otp, token).' });
    }

    try {
      const [hash, expires] = token.split('.');
      if (!hash || !expires) {
        return res.status(400).json({ error: 'Formato de token no válido.' });
      }

      if (Date.now() > parseInt(expires, 10)) {
        return res.status(400).json({ error: 'El código de verificación ha caducado. Por favor, solicite uno nuevo.' });
      }

      const dataToSign = `${customerId}|${otp}|${expires}`;
      const expectedHash = crypto.createHmac('sha256', serviceKey).update(dataToSign).digest('hex');

      if (hash !== expectedHash) {
        return res.status(400).json({ error: 'Código de verificación incorrecto. Inténtelo de nuevo.' });
      }

      // Generate a permanent session token for the next 24h
      const sessionExpires = Date.now() + 24 * 60 * 60 * 1000;
      const sessionData = `${customerId}|${sessionExpires}`;
      const sessionHash = crypto.createHmac('sha256', serviceKey).update(sessionData).digest('hex');
      const sessionToken = `${sessionHash}.${sessionExpires}`;

      // Retrieve customer details to return to the UI
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      return res.status(200).json({
        success: true,
        sessionToken,
        customer
      });
    } catch (err) {
      console.error('Verify OTP error:', err);
      return res.status(500).json({ error: 'Error interno de verificación.', details: err.message });
    }
  }

  return res.status(400).json({ error: 'Acción no válida' });
}
