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
    const pageNumber = parseInt(req.query.pageNumber) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;

    const url = `https://api.momentum.io/v1/meetings?from=${encodeURIComponent(from)}&pageSize=${pageSize}&pageNumber=${pageNumber}`;

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

    // Return raw Momentum response + debug info
    return res.status(200).json({
      debug: {
        requestUrl: url,
        rawPageCount: data.pageCount,
        meetingsReturned: (data.meetings || []).length,
        firstMeetingDate: data.meetings?.[0]?.startTime,
        lastMeetingDate: data.meetings?.[data.meetings.length - 1]?.startTime,
        allKeys: Object.keys(data)
      },
      meetings: data.meetings || [],
      pageCount: data.pageCount
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
