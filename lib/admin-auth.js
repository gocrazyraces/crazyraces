export function requireAdminAuth(req, res) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    res.status(500).send('Admin credentials not configured');
    return false;
  }

  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    res.status(401).send('Authentication required');
    return false;
  }

  const encoded = header.replace('Basic ', '');
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');

  if (user !== username || pass !== password) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    res.status(401).send('Invalid credentials');
    return false;
  }

  return true;
}