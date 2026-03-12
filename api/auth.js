import crypto from 'crypto';

// AUTH_USERS format: "megan:password1,eric:password2"
function getUsers() {
  const raw = process.env.AUTH_USERS || '';
  const users = {};
  raw.split(',').forEach(pair => {
    const [u, p] = pair.trim().split(':');
    if (u && p) users[u.toLowerCase().trim()] = p.trim();
  });
  return users;
}

function makeToken(username) {
  const secret = process.env.AUTH_SECRET || 'fallback-secret-change-me';
  const payload = `${username}:${secret}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function validateToken(req) {
  const token = req.headers['x-auth-token'];
  if (!token) return false;
  // Token is "username:hash" — validate the hash
  const parts = token.split(':');
  if (parts.length < 2) return false;
  const username = parts.slice(0, -1).join(':');
  const hash = parts[parts.length - 1];
  const expected = makeToken(username);
  return hash === expected;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const users = getUsers();
  const stored = users[username.toLowerCase().trim()];

  if (!stored || stored !== password) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const hash = makeToken(username.toLowerCase().trim());
  const token = `${username.toLowerCase().trim()}:${hash}`;
  return res.status(200).json({ ok: true, token, username: username.toLowerCase().trim() });
}
