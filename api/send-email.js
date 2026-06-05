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

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

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

    if (background) {
      // Respond immediately to the client
      res.status(200).json({ success: true, message: 'Email sending initiated in background' });

      // Send the email asynchronously in the background using Vercel's waitUntil
      waitUntil(
        transporter.sendMail(mailOptions)
          .then(info => {
            console.log('Email sent in background:', info.messageId);
          })
          .catch(error => {
            console.error('Error sending email in background:', error);
          })
      );
    } else {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return res.status(200).json({ success: true, messageId: info.messageId });
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}

