const jwt = require('jsonwebtoken');

function requireFinanceAccess(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in to view finance data.' });
  try {
    const session = jwt.verify(token, process.env.JWT_SECRET || 'brightloop_jwt_secret');
    req.user = session;
    req.auth = session;
    if (!['admin', 'staff', 'customer'].includes(session.role)) {
      return res.status(403).json({ error: 'Finance data is available to authorized accounts only.' });
    }
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session is invalid or has expired.' });
  }
}

module.exports = requireFinanceAccess;
