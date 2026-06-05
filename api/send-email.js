import nodemailer from 'nodemailer';
import { waitUntil } from '@vercel/functions';

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

  const { to, subject, text, html, attachmentBase64, attachmentName, background } = req.body;

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: 'Missing required email fields (to, subject, text/html)' });
  }

  const auth = {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  };

  const mailOptions = {
    from: process.env.GMAIL_USER,
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
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for port 465, false for other ports
      auth,
      connectionTimeout: 5000, // 5 seconds
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent via port 587:', info.messageId);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error587) {
    console.warn('Failed to send email on port 587, retrying on port 465...', error587);
    try {
      const transporter465 = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      });

      const info = await transporter465.sendMail(mailOptions);
      console.log('Email sent via port 465:', info.messageId);
      return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error465) {
      console.error('Error sending email on both ports 587 and 465:', error465);
      return res.status(500).json({ error: 'Failed to send email', details: error465.message });
    }
  }
}

