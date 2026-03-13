import { validateToken } from './auth.js';

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
  if (!validateToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  // GET — fetch history for a merchant, or list all merchants
  if (req.method === 'GET') {
    const { merchant, all } = req.query;

    // List all merchants
    if (all === 'true') {
      try {
        const { blobs } = await list({ prefix: 'merchant-history/' });
        const merchants = await Promise.all(blobs.map(async blob => {
          const name = blob.pathname
            .replace('merchant-history/', '')
            .replace('.json', '')
            .replace(/_/g, ' ');
          const res = await fetch(blob.downloadUrl, {
            headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN }
          });
          const history = res.ok ? await res.json() : [];
          return {
            name,
            key: blob.pathname,
            count: history.length,
            lastEmail: history[0] || null,
            emails: history
          };
        }));
        // Sort by most recently updated
        merchants.sort((a, b) => {
          const da = a.lastEmail?.date ? new Date(a.lastEmail.date) : 0;
          const db = b.lastEmail?.date ? new Date(b.lastEmail.date) : 0;
          return db - da;
        });
        return res.status(200).json({ merchants });
      } catch (e) {
        console.error('[history LIST]', e.message);
        return res.status(500).json({ error: e.message });
      }
    }

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
        access: 'public',
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
