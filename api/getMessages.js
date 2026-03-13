module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Return only display-safe fields — NO metadata
  const messages = (global._messages || []).map(({ id, username, message, timestamp }) => ({
    id,
    username,
    message,
    timestamp,
  }));

  return res.status(200).json(messages);
};
