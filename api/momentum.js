export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.MOMENTUM_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Momentum API key not configured' });
  }

  try {
    const response = await fetch('https://api.momentum.io/v1/meetings?limit=10', {
      headers: { 'X-API-Key': key }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: `Momentum API error: ${response.status}`,
        details: text
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
