module.exports = async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/send.html?g_error=missing');

  try {
    // Exchange code for token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const { access_token } = await tokenRes.json();

    // Get user info
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const profile = await profileRes.json();

    // Store name + email in cookie
    const senderInfo = encodeURIComponent(`${profile.name} (${profile.email})`);
    res.setHeader('Set-Cookie', `g_user=${senderInfo}; Path=/; Max-Age=86400; SameSite=Lax`);
    res.redirect('/send.html');

  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect('/send.html?g_error=server');
  }
};