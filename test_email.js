import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('Using Gmail User:', process.env.GMAIL_USER);
console.log('App Password length:', process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 0);

// Set up transporter with strict timeout settings
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for port 465, false for other ports
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 5000, // 5 seconds
  greetingTimeout: 5000,
  socketTimeout: 5000,
});

async function main() {
  try {
    console.log('Verifying transporter connection to smtp.gmail.com:587...');
    await transporter.verify();
    console.log('Transporter is ready to send!');
  } catch (error) {
    console.error('Error occurred on port 587:', error);
    
    // Fallback: try port 465
    console.log('Retrying on port 465 (secure: true)...');
    const transporter465 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });

    try {
      await transporter465.verify();
      console.log('Transporter (465) is ready to send!');
    } catch (err465) {
      console.error('Error occurred on port 465:', err465);
    }
  }
}

main();
