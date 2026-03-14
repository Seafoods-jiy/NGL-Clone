const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 2. Fetch from KV (get all items in the list)
    const messages = await kv.lrange('messages', 0, -1);
    
    // 3. Return messages (or empty array if null)
    return res.status(200).json(messages || []);
  } catch (err) {
    console.error("❌ KV Read Error:", err.message);
    return res.status(500).json({ error: "Could not load messages" });
  }
};