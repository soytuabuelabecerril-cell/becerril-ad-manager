import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

console.log('--- Resend API Test ---');
console.log('API Key configured:', apiKey ? 'Yes (length: ' + apiKey.length + ')' : 'No');
console.log('Sender Email (From):', fromEmail);

if (!apiKey) {
  console.error('ERROR: RESEND_API_KEY environment variable is not defined in .env');
  process.exit(1);
}

async function testSend() {
  const payload = {
    from: fromEmail,
    to: ['sbs.comite@gmail.com'], // Sent to your own email address
    subject: 'Prueba de Resend - Revista Becerril',
    html: '<p>¡Hola! Esto es una prueba de envío de correo electrónico a través de la API de <strong>Resend</strong> para Revista Becerril.</p>'
  };

  console.log(`Attempting to send email to sbs.comite@gmail.com...`);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('SUCCESS! Email sent successfully via Resend API.');
      console.log('Message ID:', data.id);
    } else {
      console.error('FAILED to send email.');
      console.error('Error Details:', JSON.stringify(data, null, 2));
      console.log('\nTIP: If you are using the default onboarding@resend.dev sender, you can ONLY send emails to the email address you signed up with on Resend. If you want to send emails to anyone, you must verify your custom domain in the Resend dashboard.');
    }
  } catch (error) {
    console.error('Network or fetch error:', error);
  }
}

testSend();
