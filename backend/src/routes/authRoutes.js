import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Credential from '../models/Credential.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;
const safeUser = ({ id, email, role }) => ({ id, email, role });
const issueToken = user => jwt.sign(safeUser(user), process.env.JWT_SECRET, { expiresIn: '8h' });

router.post('/register', async (req, res, next) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (!passwordRule.test(password)) return res.status(400).json({ error: 'Password must be longer than 8 characters and include uppercase, lowercase, and a special character.' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });

    const user = await User.create({ id: `usr_${crypto.randomUUID()}`, email, role: 'customer' });
    await Credential.create({ user_id: user.id, password_hash: await bcrypt.hash(password, 12) });
    return res.status(201).json({ user: safeUser(user), token: issueToken(user) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const user = await User.findOne({ email });
    const credential = user && await Credential.findOne({ user_id: user.id });
    if (!user || !credential || !await bcrypt.compare(String(req.body.password ?? ''), credential.password_hash)) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    return res.json({ user: safeUser(user), token: issueToken(user) });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.auth.id }).lean();
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    return res.json({ user: safeUser(user) });
  } catch (error) { next(error); }
});

router.post('/staff', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (!passwordRule.test(password)) return res.status(400).json({ error: 'Password must be longer than 8 characters and include uppercase, lowercase, and a special character.' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });
    const user = await User.create({ id: `usr_${crypto.randomUUID()}`, email, role: 'staff' });
    await Credential.create({ user_id: user.id, password_hash: await bcrypt.hash(password, 12) });
    return res.status(201).json({ user: safeUser(user) });
  } catch (error) { next(error); }
});

router.post('/password-reset/request', async (req, res, next) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const user = await User.findOne({ email });
    // Always return the same response to avoid revealing whether an account exists.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const credential = await Credential.findOne({ user_id: user.id });
      credential.reset_token_hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      credential.reset_token_expires_at = new Date(Date.now() + 30 * 60 * 1000);
      await credential.save();
      const resetUrl = `${process.env.APP_URL ?? 'http://localhost:5173'}/reset-password?token=${rawToken}`;
      if (process.env.NODE_ENV === 'production') {
        // Configure a mail provider before production use; never expose reset tokens in an API response.
        if (!process.env.RESET_EMAIL_WEBHOOK) return res.status(503).json({ error: 'Password reset email is not configured.' });
        await fetch(process.env.RESET_EMAIL_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, resetUrl }) });
      } else {
        console.info(`Password reset link for ${email}: ${resetUrl}`);
      }
    }
    return res.json({ message: 'If an account exists for that email, password reset instructions will be sent.' });
  } catch (error) { next(error); }
});

router.post('/password-reset/confirm', async (req, res, next) => {
  try {
    const rawToken = String(req.body.token ?? '');
    const password = String(req.body.password ?? '');
    if (!passwordRule.test(password)) return res.status(400).json({ error: 'Password must be longer than 8 characters and include uppercase, lowercase, and a special character.' });
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const credential = await Credential.findOne({ reset_token_hash: tokenHash, reset_token_expires_at: { $gt: new Date() } });
    if (!credential) return res.status(400).json({ error: 'Reset link is invalid or expired.' });
    credential.password_hash = await bcrypt.hash(password, 12);
    credential.reset_token_hash = null;
    credential.reset_token_expires_at = null;
    await credential.save();
    return res.json({ message: 'Password updated. You can now sign in.' });
  } catch (error) { next(error); }
});

export default router;
