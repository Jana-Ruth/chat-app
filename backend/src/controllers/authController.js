const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../config/email');
const { uploadBuffer } = require('../config/cloudinary');

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

async function register(req, res) {
  try {
    const { username, email, password, phone, bio } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({ error: 'Username or email already in use' });
    }

    let avatarUrl = '';
    if (req.file) {
      const avatar = await uploadBuffer(req.file, { folder: 'avatars', type: 'avatar' });
      avatarUrl = avatar.secure_url;
    }

    const user = await User.create({
      username,
      email,
      password,
      phone: phone || '',
      bio: bio || '',
      avatarUrl,
    });
    const token = signToken(user._id);

    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user._id);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
}

async function me(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: user.toSafeObject() });
}

// POST /api/auth/forgot-password
// Always responds with a generic success message, whether or not the email
// exists, so an attacker can't use this to discover registered emails.
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const genericResponse = {
    message: "If an account with that email exists, we've sent a password reset link.",
  };

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json(genericResponse);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (emailErr) {
      // Log it, but still return the generic success response — don't leak
      // whether the email step succeeded, and don't block the response on a
      // third-party outage.
      console.error('Failed to send password reset email:', emailErr.message);
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.json(genericResponse);
  }
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordTokenHash +resetPasswordExpires');

  if (!user) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired' });
  }

  user.password = newPassword; // pre-save hook rehashes
  user.resetPasswordTokenHash = null;
  user.resetPasswordExpires = null;
  await user.save();

  res.json({ message: 'Password reset successfully. You can now log in.' });
}

module.exports = { register, login, me, forgotPassword, resetPassword };



