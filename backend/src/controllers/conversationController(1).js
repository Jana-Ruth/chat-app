const Conversation = require('../models/Conversation');
const User = require('../models/User');

// GET /api/conversations - list all conversations for the logged-in user
async function listConversations(req, res) {
  const conversations = await Conversation.find({ participants: req.userId })
    .populate('participants', 'username email avatarUrl isOnline lastSeen')
    .populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'username' },
    })
    .sort({ updatedAt: -1 });

  res.json({ conversations });
}

// POST /api/conversations - create a 1:1 or group conversation
// body: { participantIds: [...], isGroup: bool, name?: string }
async function createConversation(req, res) {
  const { participantIds, isGroup, name } = req.body;

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: 'participantIds must be a non-empty array' });
  }

  const allParticipants = Array.from(new Set([...participantIds, req.userId]));

  if (!isGroup) {
    if (allParticipants.length !== 2) {
      return res.status(400).json({ error: 'A direct conversation must have exactly 2 participants' });
    }

    const otherId = allParticipants.find((p) => p !== req.userId);
    const [me, other] = await Promise.all([
      User.findById(req.userId).select('blockedUsers'),
      User.findById(otherId).select('blockedUsers'),
    ]);
    if (!other) return res.status(404).json({ error: 'User not found' });
    if (me.blockedUsers.some((b) => b.toString() === otherId)) {
      return res.status(403).json({ error: 'You have blocked this user. Unblock them to start a conversation.' });
    }
    if (other.blockedUsers.some((b) => b.toString() === req.userId)) {
      return res.status(403).json({ error: 'You cannot message this user' });
    }

    // reuse existing 1:1 conversation if one already exists
    const existing = await Conversation.findOne({
      isGroup: false,
      participants: { $all: allParticipants, $size: 2 },
    }).populate('participants', 'username email avatarUrl isOnline lastSeen');

    if (existing) {
      return res.status(200).json({ conversation: existing });
    }
  }

  if (isGroup && (!name || !name.trim())) {
    return res.status(400).json({ error: 'Group conversations require a name' });
  }

  const conversation = await Conversation.create({
    isGroup: !!isGroup,
    name: isGroup ? name.trim() : '',
    participants: allParticipants,
    admins: isGroup ? [req.userId] : [],
  });

  const populated = await conversation.populate('participants', 'username email avatarUrl isOnline lastSeen');

  res.status(201).json({ conversation: populated });
}

// POST /api/conversations/:id/participants - add member to a group
async function addParticipant(req, res) {
  const { id } = req.params;
  const { userId } = req.body;

  const conversation = await Conversation.findById(id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  if (!conversation.isGroup) return res.status(400).json({ error: 'Cannot add participants to a direct conversation' });
  if (!conversation.admins.some((a) => a.toString() === req.userId)) {
    return res.status(403).json({ error: 'Only admins can add participants' });
  }

  if (!conversation.participants.some((p) => p.toString() === userId)) {
    conversation.participants.push(userId);
    await conversation.save();
  }

  const populated = await conversation.populate('participants', 'username email avatarUrl isOnline lastSeen');
  res.json({ conversation: populated });
}

// DELETE /api/conversations/:id/participants/:userId - admin removes a member
async function removeParticipant(req, res) {
  const { id, userId } = req.params;

  const conversation = await Conversation.findById(id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  if (!conversation.isGroup) return res.status(400).json({ error: 'Cannot remove participants from a direct conversation' });
  if (!conversation.admins.some((a) => a.toString() === req.userId)) {
    return res.status(403).json({ error: 'Only admins can remove participants' });
  }
  if (userId === req.userId) {
    return res.status(400).json({ error: 'Use the leave endpoint to remove yourself' });
  }

  conversation.participants = conversation.participants.filter((p) => p.toString() !== userId);
  conversation.admins = conversation.admins.filter((a) => a.toString() !== userId);
  await conversation.save();

  const populated = await conversation.populate('participants', 'username email avatarUrl isOnline lastSeen');
  res.json({ conversation: populated });
}

// POST /api/conversations/:id/leave - a participant leaves a group themselves
async function leaveConversation(req, res) {
  const { id } = req.params;

  const conversation = await Conversation.findById(id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  if (!conversation.isGroup) return res.status(400).json({ error: 'Cannot leave a direct conversation' });

  conversation.participants = conversation.participants.filter((p) => p.toString() !== req.userId);
  conversation.admins = conversation.admins.filter((a) => a.toString() !== req.userId);

  // if the group still has members but no admin left, promote the earliest remaining participant
  if (conversation.admins.length === 0 && conversation.participants.length > 0) {
    conversation.admins.push(conversation.participants[0]);
  }

  await conversation.save();
  res.json({ success: true });
}

module.exports = {
  listConversations,
  createConversation,
  addParticipant,
  removeParticipant,
  leaveConversation,
};
