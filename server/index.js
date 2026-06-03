import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;

// Load environment variables from the root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Set up Nodemailer transporter for Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

app.post('/api/send-email', async (req, res) => {
  const { to, subject, text, html, attachmentBase64, attachmentName } = req.body;

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: 'Missing required email fields (to, subject, text/html)' });
  }

  try {
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject,
      text,
      html
    };

    if (attachmentBase64 && attachmentName) {
      // Data URI format: data:image/png;base64,iVBORw0KGgo...
      // Nodemailer can handle data URIs directly using the `path` property
      mailOptions.attachments = [
        {
          filename: attachmentName,
          path: attachmentBase64
        }
      ];
    }

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent:', info.messageId);
    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
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
      ALTER TABLE public.ad_reservations 
      ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      ALTER TABLE public.invoices 
      ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      ALTER TABLE public.recibos 
      ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE;
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

app.listen(PORT, () => {
  console.log(`Email backend server running on http://localhost:${PORT}`);
});
