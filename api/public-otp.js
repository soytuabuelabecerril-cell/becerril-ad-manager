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
    const { email, isNewCustomer, businessName, whatsapp } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Falta el correo electrónico.' });
    }

    try {
      let customerIdForToken = '';
      let targetEmail = email.trim();
      let maskedEmail = targetEmail;

      if (isNewCustomer) {
        if (!businessName) {
          return res.status(400).json({ error: 'Falta el nombre de su negocio.' });
        }

        // Check if email already registered
        const { data: existingCustomer, error: existErr } = await supabase
          .from('customers')
          .select('id')
          .eq('email', targetEmail)
          .limit(1)
          .maybeSingle();

        if (existErr) throw existErr;

        if (existingCustomer) {
          return res.status(400).json({ error: 'Este correo electrónico ya está registrado. Por favor, seleccione que ha anunciado antes para iniciar sesión.' });
        }
      } else {
        // Existing customer: lookup by email
        const { data: customer, error: custErr } = await supabase
          .from('customers')
          .select('id, email, whatsapp, commercial_name, fiscal_name')
          .eq('email', targetEmail)
          .limit(1)
          .maybeSingle();

        if (custErr) throw custErr;

        if (!customer) {
          return res.status(404).json({ error: 'No se encontró ningún negocio registrado con este correo electrónico. Seleccione "No" para registrarse como nuevo anunciante o revise el correo.' });
        }

        customerIdForToken = customer.id;
        targetEmail = customer.email;
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 15 * 60 * 1000; // 15 mins
      
      // Hash code statelessly
      const tokenIdentifier = isNewCustomer ? targetEmail : customerIdForToken;
      const dataToSign = `${tokenIdentifier}|${otp}|${expires}`;
      const hash = crypto.createHmac('sha256', serviceKey).update(dataToSign).digest('hex');
      const token = `${hash}.${expires}`;

      // Send email
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        return res.status(500).json({ error: 'RESEND_API_KEY is not configured on the server.' });
      }
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

      const emailSubject = `Código de verificación: ${otp} - Revista Becerril 2026`;
      const emailText = `Hola,\n\nSu código de verificación para realizar la reserva es: ${otp}\n\nEste código caducará en 15 minutos.\n\nEquipo de Revista Becerril 2026`;
      
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
          to: [targetEmail],
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
      const maskEmail = (emailStr) => {
        const [name, domain] = emailStr.split('@');
        if (name.length <= 2) return `${name[0]}***@${domain}`;
        return `${name.substring(0, 2)}***${name.substring(name.length - 1)}@${domain}`;
      };

      return res.status(200).json({
        success: true,
        token,
        customerId: customerIdForToken,
        email: isNewCustomer ? targetEmail : maskEmail(targetEmail)
      });
    } catch (err) {
      console.error('Send OTP error:', err);
      return res.status(500).json({ error: 'Error interno del servidor.', details: err.message });
    }
  } 
  
  if (action === 'verify') {
    const { email, customerId, otp, token, isNewCustomer, businessName, contactName, whatsapp } = req.body;
    if ((isNewCustomer && !email) || (!isNewCustomer && !customerId) || !otp || !token) {
      return res.status(400).json({ error: 'Faltan parámetros obligatorios.' });
    }

    try {
      const [hash, expires] = token.split('.');
      if (!hash || !expires) {
        return res.status(400).json({ error: 'Formato de token no válido.' });
      }

      if (Date.now() > parseInt(expires, 10)) {
        return res.status(400).json({ error: 'El código de verificación ha caducado. Por favor, solicite uno nuevo.' });
      }

      const tokenIdentifier = isNewCustomer ? email.trim() : customerId;
      const dataToSign = `${tokenIdentifier}|${otp}|${expires}`;
      const expectedHash = crypto.createHmac('sha256', serviceKey).update(dataToSign).digest('hex');

      if (hash !== expectedHash) {
        return res.status(400).json({ error: 'Código de verificación incorrecto. Inténtelo de nuevo.' });
      }

      let activeCustomer = null;
      let finalCustomerId = customerId;

      if (isNewCustomer) {
        // Verify unique email first
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('email', email.trim())
          .limit(1)
          .maybeSingle();

        if (existingCustomer) {
          return res.status(400).json({ error: 'Este correo electrónico ya está registrado.' });
        }

        // Insert new customer
        const newCustomerData = {
          commercial_name: businessName.trim(),
          fiscal_name: businessName.trim(),
          contact_name: contactName ? contactName.trim() : null,
          email: email.trim(),
          whatsapp: whatsapp ? whatsapp.trim() : null,
          created_at: new Date().toISOString()
        };

        const { data: insertedCustomer, error: insertErr } = await supabase
          .from('customers')
          .insert([newCustomerData])
          .select()
          .single();

        if (insertErr) {
          console.error('Failed to insert new customer:', insertErr);
          return res.status(500).json({ error: 'Error al registrar el nuevo cliente en la base de datos.', details: insertErr.message });
        }

        activeCustomer = insertedCustomer;
        finalCustomerId = insertedCustomer.id;
      } else {
        // Retrieve existing customer details
        const { data: existingCust, error: getErr } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (getErr) throw getErr;
        activeCustomer = existingCust;
      }

      // Generate a permanent session token for the next 24h
      const sessionExpires = Date.now() + 24 * 60 * 60 * 1000;
      const sessionData = `${finalCustomerId}|${sessionExpires}`;
      const sessionHash = crypto.createHmac('sha256', serviceKey).update(sessionData).digest('hex');
      const sessionToken = `${sessionHash}.${sessionExpires}`;

      return res.status(200).json({
        success: true,
        sessionToken,
        customer: activeCustomer
      });
    } catch (err) {
      console.error('Verify OTP error:', err);
      return res.status(500).json({ error: 'Error interno de verificación.', details: err.message });
    }
  }

  return res.status(400).json({ error: 'Acción no válida' });
}
