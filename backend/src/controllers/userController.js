const bcrypt = require('bcryptjs');
const User = require('../models/User');

// GET /api/users/search?q=ruth
async function searchUsers(req, res) {
  const { q } = req.query;
  if (!q || q.trim().length === 0) {
    return res.json({ users: [] });
  }

  const me = await User.findById(req.userId).select('blockedUsers');
  // exclude people I've blocked, and people who have blocked me
  const blockedByMe = me?.blockedUsers || [];
  const whoBlockedMe = await User.find({ blockedUsers: req.userId }).select('_id');
  const excludeIds = [req.userId, ...blockedByMe, ...whoBlockedMe.map((u) => u._id)];

  const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const users = await User.find({
    _id: { $nin: excludeIds },
    $or: [{ username: regex }, { email: regex }],
  })
    .limit(20)
    .select('username email avatarUrl isOnline lastSeen');

  res.json({ users });
}

// GET /api/users/:id - public profile view
async function getProfile(req, res) {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const me = await User.findById(req.userId).select('blockedUsers');
  const iBlockedThem = me.blockedUsers.some((b) => b.toString() === id);
  const theyBlockedMe = user.blockedUsers.some((b) => b.toString() === req.userId);

  res.json({
    user: user.toPublicObject(),
    iBlockedThem,
    theyBlockedMe,
  });
}

// PUT /api/users/me - update own profile (multipart if avatar included)
async function updateProfile(req, res) {
  try {
    const { username, bio, phone } = req.body;
    const update = {};

    if (username !== undefined) {
      const trimmed = username.trim();
      if (trimmed.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }
      const existing = await User.findOne({ username: trimmed, _id: { $ne: req.userId } });
      if (existing) return res.status(409).json({ error: 'Username already taken' });
      update.username = trimmed;
    }
    if (bio !== undefined) update.bio = bio.trim().slice(0, 300);
    if (phone !== undefined) update.phone = phone.trim().slice(0, 20);
    if (req.file) update.avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true, runValidators: true });
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

// PUT /api/users/me/password
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const user = await User.findById(req.userId).select('+password');
  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

  user.password = newPassword; // pre-save hook rehashes
  await user.save();

  res.json({ success: true });
}

// POST /api/users/:id/block
async function blockUser(req, res) {
  const { id } = req.params;
  if (id === req.userId) return res.status(400).json({ error: "You can't block yourself" });

  await User.findByIdAndUpdate(req.userId, { $addToSet: { blockedUsers: id } });
  res.json({ success: true });
}

// POST /api/users/:id/unblock
async function unblockUser(req, res) {
  const { id } = req.params;
  await User.findByIdAndUpdate(req.userId, { $pull: { blockedUsers: id } });
  res.json({ success: true });
}

// GET /api/users/me/blocked
async function listBlocked(req, res) {
  const me = await User.findById(req.userId).populate('blockedUsers', 'username avatarUrl');
  res.json({ users: me.blockedUsers });
}

module.exports = {
  searchUsers,
  getProfile,
  updateProfile,
  changePassword,
  blockUser,
  unblockUser,
  listBlocked,
};
