import { put, list, del } from '@vercel/blob';

function normalizeKey(name) {
  return 'merchant-history/' + name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.json';
}

async function getHistory(key) {
  const { blobs } = await list({ prefix: key });
  if (!blobs.length) return [];
  const res = await fetch(blobs[0].downloadUrl, {
    headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN }
  });
  if (!res.ok) return [];
  return await res.json();
}

export default async function handler(req, res) {

  // GET — fetch history for a merchant
  if (req.method === 'GET') {
    const { merchant } = req.query;
    if (!merchant) return res.status(400).json({ error: 'merchant param required' });
    try {
      const history = await getHistory(normalizeKey(merchant));
      return res.status(200).json({ merchant, history });
    } catch (e) {
      console.error('[history GET]', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // POST — save a new email entry
  if (req.method === 'POST') {
    const { merchant, entry } = req.body || {};
    if (!merchant || !entry) return res.status(400).json({ error: 'merchant and entry required' });
    try {
      const key = normalizeKey(merchant);
      const existing = await getHistory(key);
      const updated = [entry, ...existing].slice(0, 50);
      await put(key, JSON.stringify(updated), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        cacheControlMaxAge: 0
      });
      return res.status(200).json({ ok: true, count: updated.length });
    } catch (e) {
      console.error('[history POST]', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // DELETE — clear history for a merchant
  if (req.method === 'DELETE') {
    const { merchant } = req.query;
    if (!merchant) return res.status(400).json({ error: 'merchant param required' });
    try {
      const key = normalizeKey(merchant);
      const { blobs } = await list({ prefix: key });
      if (blobs.length) await del(blobs.map(b => b.url));
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[history DELETE]', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
