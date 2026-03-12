// Uses Upstash Redis REST API directly via fetch — no extra dependencies needed.
// Reads KV_REDIS_URL (set automatically by the Upstash Vercel integration).
// The URL format is: redis://default:<token>@<host>
// We parse it to build REST API calls.

function getUpstashConfig() {
  const url = process.env.KV_REDIS_URL;
  if (!url) throw new Error('KV_REDIS_URL is not set.');
  // redis://default:<token>@<hostname>
  const match = url.match(/redis:\/\/[^:]+:([^@]+)@([^/]+)/);
  if (!match) throw new Error('KV_REDIS_URL format not recognized: ' + url);
  const token = match[1];
  const host = match[2];
  return { restUrl: `https://${host}`, token };
}

async function redisCommand(...args) {
  const { restUrl, token } = getUpstashConfig();
  const res = await fetch(`${restUrl}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

// Normalize merchant name for consistent key lookup
function normalizeKey(name) {
  return 'merchant:' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export default async function handler(req, res) {
  // GET — fetch history for a merchant
  if (req.method === 'GET') {
    const { merchant } = req.query;
    if (!merchant) return res.status(400).json({ error: 'merchant param required' });
    try {
      const key = normalizeKey(merchant);
      const raw = await redisCommand('GET', key);
      const history = raw ? JSON.parse(raw) : [];
      return res.status(200).json({ merchant, history });
    } catch (e) {
      console.error('Redis GET error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // POST — save a new email to merchant history
  if (req.method === 'POST') {
    const { merchant, entry } = req.body;
    if (!merchant || !entry) return res.status(400).json({ error: 'merchant and entry required' });
    try {
      const key = normalizeKey(merchant);
      const raw = await redisCommand('GET', key);
      const existing = raw ? JSON.parse(raw) : [];
      const updated = [entry, ...existing].slice(0, 50);
      await redisCommand('SET', key, JSON.stringify(updated));
      return res.status(200).json({ ok: true, count: updated.length });
    } catch (e) {
      console.error('Redis POST error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // DELETE — clear history for a merchant
  if (req.method === 'DELETE') {
    const { merchant } = req.query;
    if (!merchant) return res.status(400).json({ error: 'merchant param required' });
    try {
      const key = normalizeKey(merchant);
      await redisCommand('DEL', key);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
