export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.MOMENTUM_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Momentum API key not configured' });
  }

  try {
    const from = req.query.from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const search = (req.query.search || '').toLowerCase();

    // Fetch up to 3 pages of 100 meetings each to cast a wider net
    let allMeetings = [];
    let page = 1;
    const maxPages = 3;

    while (page <= maxPages) {
      const url = `https://api.momentum.io/v1/meetings?from=${encodeURIComponent(from)}&limit=100&page=${page}`;

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
      allMeetings = allMeetings.concat(meetings);

      // If we got fewer than 100, we've reached the end
      if (meetings.length < 100) break;

      // If searching and we already found a match, stop early
      if (search && allMeetings.some(m =>
        (m.title || '').toLowerCase().includes(search) ||
        (m.attendees || []).some(a =>
          (a.name || '').toLowerCase().includes(search) ||
          (a.email || '').toLowerCase().includes(search) ||
          (a.company || '').toLowerCase().includes(search)
        )
      )) break;

      page++;
    }

    // Sort newest first
    allMeetings.sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));

    return res.status(200).json({
      meetings: allMeetings,
      totalFetched: allMeetings.length,
      pagesFetched: page
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
