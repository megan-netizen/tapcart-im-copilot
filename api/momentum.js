export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.MOMENTUM_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Momentum API key not configured' });
  }

  try {
    // Default to last 14 days for speed — most searches are recent
    const from = req.query.from || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const search = (req.query.search || '').toLowerCase();
    const maxPages = 20; // Cap at 1000 meetings max

    let allMeetings = [];
    let pageNumber = 1;
    let totalPages = 1;

    while (pageNumber <= Math.min(totalPages, maxPages)) {
      const url = `https://api.momentum.io/v1/meetings?from=${encodeURIComponent(from)}&pageSize=50&pageNumber=${pageNumber}`;

      const response = await fetch(url, {
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
      const meetings = data.meetings || [];
      totalPages = data.pageCount || 1;

      allMeetings = allMeetings.concat(meetings);

      // If searching, check if we found a match — stop early
      if (search) {
        const found = allMeetings.some(m =>
          (m.title || '').toLowerCase().includes(search) ||
          (m.attendees || []).some(a =>
            (a.name || '').toLowerCase().includes(search) ||
            (a.email || '').toLowerCase().includes(search)
          )
        );
        if (found) break;
      }

      pageNumber++;
    }

    // Sort newest first
    allMeetings.sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));

    return res.status(200).json({
      meetings: allMeetings,
      totalFetched: allMeetings.length,
      pagesFetched: pageNumber,
      totalPagesAvailable: totalPages
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
