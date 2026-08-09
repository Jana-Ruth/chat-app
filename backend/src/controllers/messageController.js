const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

function clearedAtFor(conversation, userId) {
  const marker = conversation.clearedFor?.find((entry) => entry.user.toString() === userId);
  return marker?.clearedAt || null;
}

// GET /api/conversations/:id/messages?before=<messageId>&limit=30
async function getMessages(req, res) {
  const { id } = req.params;
  const { before, limit = 30 } = req.query;

  const conversation = await Conversation.findById(id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  if (!conversation.participants.some((p) => p.toString() === req.userId)) {
    return res.status(403).json({ error: 'Not a participant of this conversation' });
  }

  const query = { conversation: id };
  const clearedAt = clearedAtFor(conversation, req.userId);
  if (clearedAt) query.createdAt = { $gt: clearedAt };
  if (before) {
    const beforeMsg = await Message.findById(before);
    if (beforeMsg) {
      query.createdAt = {
        ...(query.createdAt || {}),
        $lt: beforeMsg.createdAt,
      };
    }
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 30, 100))
    .populate('sender', 'username avatarUrl');

  res.json({ messages: messages.reverse() });
}

// GET /api/conversations/:id/messages/search?q=term
async function searchMessages(req, res) {
  const { id } = req.params;
  const { q } = req.query;

  if (!q || !q.trim()) return res.json({ messages: [] });

  const conversation = await Conversation.findById(id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  if (!conversation.participants.some((p) => p.toString() === req.userId)) {
    return res.status(403).json({ error: 'Not a participant of this conversation' });
  }

  const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const query = {
    conversation: id,
    deleted: { $ne: true },
    text: regex,
  };
  const clearedAt = clearedAtFor(conversation, req.userId);
  if (clearedAt) query.createdAt = { $gt: clearedAt };

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('sender', 'username avatarUrl');

  res.json({ messages });
}

module.exports = { getMessages, searchMessages };