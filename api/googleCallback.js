module.exports = async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing code from Instagram.');
  }

  try {
    // Step 1: Exchange code for short-lived access token
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.IG_CLIENT_ID,
        client_secret: process.env.IG_CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: process.env.IG_REDIRECT_URI,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('IG token error:', tokenData);
      return res.redirect('/send.html?ig_error=token');
    }

    // Step 2: Fetch real Instagram username
    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=username&access_token=${tokenData.access_token}`
    );
    const profile = await profileRes.json();

    if (!profile.username) {
      console.error('IG profile error:', profile);
      return res.redirect('/send.html?ig_error=profile');
    }

    const igUsername = profile.username;

    // Step 3: Set cookie (readable by JS so the page can show the username)
    // SameSite=Lax prevents CSRF while still allowing the redirect to work
    res.setHeader('Set-Cookie', `ig_user=${igUsername}; Path=/; Max-Age=86400; SameSite=Lax`);

    // Step 4: Redirect back to the send page
    return res.redirect('/send.html');

  } catch (err) {
    console.error('igCallback error:', err);
    return res.redirect('/send.html?ig_error=server');
  }
};