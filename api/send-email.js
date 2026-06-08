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

  const { to, subject, text, html, attachmentBase64, attachmentName } = req.body;

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: 'Missing required email fields (to, subject, text/html)' });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('RESEND_API_KEY environment variable is missing.');
    return res.status(500).json({ error: 'Server configuration error: RESEND_API_KEY is not set' });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  let attachments = undefined;
  if (attachmentBase64 && attachmentName) {
    // Strip Data URI scheme if present (e.g. "data:application/pdf;base64,iVBORw...")
    const base64Content = attachmentBase64.includes(';base64,')
      ? attachmentBase64.split(';base64,').pop()
      : attachmentBase64;

    attachments = [
      {
        filename: attachmentName,
        content: base64Content
      }
    ];
  }

  try {
    console.log(`Sending email to ${to} via Resend...`);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        text,
        html,
        attachments
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return res.status(response.status).json({ error: 'Failed to send email via Resend', details: data });
    }

    console.log('Email sent successfully via Resend. ID:', data.id);
    return res.status(200).json({ success: true, messageId: data.id });
  } catch (error) {
    console.error('Error in send-email handler:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
