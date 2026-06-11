import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Enable CORS
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

  const { customerId, to, customerName } = req.body;

  if (!customerId || !to) {
    return res.status(400).json({ error: 'Missing required fields (customerId, to)' });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return res.status(500).json({ error: 'Server configuration error: RESEND_API_KEY is not set' });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  try {
    // Resolve asset paths relative to process.cwd()
    let htmlPath = path.join(process.cwd(), 'api', 'assets', 'email_becerril_2026.html');
    let imagePath = path.join(process.cwd(), 'api', 'assets', 'Revist_Fiestas_Patronales_Becerril.jpg');

    // Fallback paths for local development if needed
    if (!fs.existsSync(htmlPath)) {
      htmlPath = 'C:\\Users\\Shadow\\Cloud-Drive\\Web dev Drutex Product Content\\Screenshots\\email_becerril_2026.html';
    }
    if (!fs.existsSync(imagePath)) {
      imagePath = 'C:\\Users\\Shadow\\Cloud-Drive\\Web dev Drutex Product Content\\Screenshots\\Revist_Fiestas_Patronales_Becerril .jpg';
    }

    if (!fs.existsSync(htmlPath)) {
      throw new Error(`HTML template file not found at ${htmlPath}`);
    }
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found at ${imagePath}`);
    }

    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Replace placeholders
    htmlContent = htmlContent.replace(/\{\{nombre\}\}/g, customerName || '');
    htmlContent = htmlContent.replace('https://TU-SERVIDOR.com/img/becerril_2026_header.jpg', `data:image/jpeg;base64,${base64Image}`);

    console.log(`Vercel function: sending email to ${to} via Resend...`);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: 'Información Revista de Fiestas Patronales Becerril de la Sierra 2026',
        html: htmlContent,
        attachments: [
          {
            filename: 'Revist_Fiestas_Patronales_Becerril.jpg',
            content: base64Image
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return res.status(response.status).json({ error: 'Failed to send email via Resend', details: data });
    }

    // Update customer in database
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { error: dbError } = await supabase
        .from('customers')
        .update({
          info_email_sent: true,
          info_email_sent_at: new Date().toISOString()
        })
        .eq('id', customerId);
      if (dbError) {
        console.error('Error updating customer email status in Supabase:', dbError);
      }
    }

    console.log('Email sent successfully via Resend. ID:', data.id);
    return res.status(200).json({ success: true, messageId: data.id });
  } catch (error) {
    console.error('Error in send-info-email handler:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
