module.exports = async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 2. Fetch from JSONBin
    const response = await fetch(
      `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`,
      {
        headers: {
          'X-Master-Key': process.env.JSONBIN_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`JSONBin error: ${response.status}`);
    }

    const data = await response.json();
    const messages = data.record.alerts || [];

    // 3. Return messages (or empty array if null)
    return res.status(200).json(messages);
  } catch (err) {
    console.error("❌ JSONBin Read Error:", err.message);
    return res.status(500).json({ error: "Could not load messages" });
  }
};