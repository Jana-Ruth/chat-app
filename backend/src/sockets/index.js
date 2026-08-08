const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// Track userId -> Set of socket ids (a user can have multiple tabs/devices)
const onlineUsers = new Map();

function addOnlineSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function removeOnlineSocket(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return false;
  set.delete(socketId);
  const isNowOffline = set.size === 0;
  if (isNowOffline) onlineUsers.delete(userId);
  return isNowOffline;
}

function initSockets(io) {
  // Authenticate every socket connection using the JWT from the handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication token missing'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.sub;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket;
    addOnlineSocket(userId, socket.id);

    // A personal room lets us address this user directly (e.g. for call
    // signaling) without needing to know which conversation is relevant.
    socket.join(`user:${userId}`);

    // Mark user online and notify their contacts (anyone sharing a conversation)
    await User.findByIdAndUpdate(userId, { isOnline: true });
    const conversations = await Conversation.find({ participants: userId }).select('_id participants');

    // Join a room per conversation so we can broadcast to all participants easily
    conversations.forEach((c) => socket.join(`conversation:${c._id}`));

    broadcastPresence(io, conversations, userId, true);

    // Catch up delivery status: any message sent to this user while they
    // were offline becomes "delivered" now that they've reconnected.
    catchUpDelivery(io, userId, conversations).catch((err) =>
      console.error('delivery catch-up error:', err)
    );

    // ---- join a specific conversation room on demand (e.g. after creating one) ----
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    // ---- send a message (text and/or an attachment uploaded via POST /api/uploads first) ----
    socket.on('message:send', async ({ conversationId, text, attachment, sticker }, ack) => {
      try {
        const hasText = text && text.trim();
        const hasAttachment = attachment && attachment.url;
        const hasSticker = sticker && sticker.emoji;
        if (!hasText && !hasAttachment && !hasSticker) {
          return ack?.({ error: 'Message must have text, an attachment, or a sticker' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.some((p) => p.toString() === userId)) {
          return ack?.({ error: 'Not authorized to post in this conversation' });
        }

        // For direct chats, block a message going through if either side has blocked the other
        if (!conversation.isGroup) {
          const otherId = conversation.participants.map((p) => p.toString()).find((p) => p !== userId);
          if (otherId) {
            const [me, other] = await Promise.all([
              User.findById(userId).select('blockedUsers'),
              User.findById(otherId).select('blockedUsers'),
            ]);
            const iBlockedThem = me?.blockedUsers.some((b) => b.toString() === otherId);
            const theyBlockedMe = other?.blockedUsers.some((b) => b.toString() === userId);
            if (iBlockedThem || theyBlockedMe) {
              return ack?.({ error: 'You cannot message this user' });
            }
          }
        }

        // Anyone else in this conversation who's currently online receives the
        // broadcast instantly, so we can mark the message delivered to them right away.
        const otherParticipantIds = conversation.participants.map((p) => p.toString()).filter((p) => p !== userId);
        const deliveredNow = otherParticipantIds.filter((id) => onlineUsers.has(id));

        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          text: hasText ? text.trim() : '',
          attachment: hasAttachment ? attachment : undefined,
          sticker: hasSticker ? sticker : undefined,
          readBy: [userId],
          deliveredTo: [userId, ...deliveredNow],
        });

        conversation.lastMessage = message._id;
        await conversation.save();

        const populated = await message.populate('sender', 'username avatarUrl');

        io.to(`conversation:${conversationId}`).emit('message:new', populated);
        ack?.({ message: populated });
      } catch (err) {
        console.error('message:send error:', err);
        ack?.({ error: 'Failed to send message' });
      }
    });

    // ---- log a call once it ends (shows up in the chat like a regular message) ----
    socket.on('call:log', async ({ conversationId, callType, status, duration }, ack) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.some((p) => p.toString() === userId)) {
          return ack?.({ error: 'Not authorized to post in this conversation' });
        }

        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          call: { callType, status, duration: duration || 0 },
          readBy: [userId],
          deliveredTo: [userId],
        });

        conversation.lastMessage = message._id;
        await conversation.save();

        const populated = await message.populate('sender', 'username avatarUrl');
        io.to(`conversation:${conversationId}`).emit('message:new', populated);
        ack?.({ message: populated });
      } catch (err) {
        console.error('call:log error:', err);
        ack?.({ error: 'Failed to log call' });
      }
    });

    // ---- edit a message (author only, within the conversation) ----
    socket.on('message:edit', async ({ messageId, text }, ack) => {
      try {
        if (!text || !text.trim()) {
          return ack?.({ error: 'Message text is required' });
        }

        const message = await Message.findById(messageId);
        if (!message || message.deleted) return ack?.({ error: 'Message not found' });
        if (message.sender.toString() !== userId) {
          return ack?.({ error: 'You can only edit your own messages' });
        }

        message.text = text.trim();
        message.edited = true;
        message.editedAt = new Date();
        await message.save();

        const populated = await message.populate('sender', 'username avatarUrl');
        io.to(`conversation:${message.conversation}`).emit('message:edited', populated);
        ack?.({ message: populated });
      } catch (err) {
        console.error('message:edit error:', err);
        ack?.({ error: 'Failed to edit message' });
      }
    });

    // ---- delete a message (soft delete, author only) ----
    socket.on('message:delete', async ({ messageId }, ack) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.deleted) return ack?.({ error: 'Message not found' });
        if (message.sender.toString() !== userId) {
          return ack?.({ error: 'You can only delete your own messages' });
        }

        message.deleted = true;
        message.deletedAt = new Date();
        message.text = '';
        message.attachment = undefined;
        message.sticker = undefined;
        await message.save();

        io.to(`conversation:${message.conversation}`).emit('message:deleted', {
          messageId: message._id,
          conversationId: message.conversation,
        });
        ack?.({ success: true });
      } catch (err) {
        console.error('message:delete error:', err);
        ack?.({ error: 'Failed to delete message' });
      }
    });

    // ---- typing indicator ----
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId, userId });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId, userId });
    });

    // ---- read receipts (reading implies delivered too) ----
    socket.on('message:read', async ({ conversationId, messageId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: { readBy: userId, deliveredTo: userId },
        });
        io.to(`conversation:${conversationId}`).emit('message:read', { conversationId, messageId, userId });
      } catch (err) {
        console.error('message:read error:', err);
      }
    });

    // =========================================================
    // Call signaling (WebRTC) — 1:1 calls only. The server never
    // touches audio/video, it just relays SDP/ICE between the two peers.
    // =========================================================

    // ---- place a call ----
    socket.on('call:invite', async ({ toUserId, conversationId, callType, sdp }, ack) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.some((p) => p.toString() === userId)) {
          return ack?.({ error: 'Not authorized for this conversation' });
        }
        if (!conversation.participants.some((p) => p.toString() === toUserId)) {
          return ack?.({ error: 'That user is not part of this conversation' });
        }

        const [me, other] = await Promise.all([
          User.findById(userId).select('username avatarUrl isOnline blockedUsers'),
          User.findById(toUserId).select('blockedUsers'),
        ]);
        const blocked =
          me?.blockedUsers.some((b) => b.toString() === toUserId) ||
          other?.blockedUsers.some((b) => b.toString() === userId);
        if (blocked) return ack?.({ error: 'You cannot call this user' });

        if (!onlineUsers.has(toUserId)) {
          return ack?.({ error: 'User is offline' });
        }

        const callId = `${conversationId}-${Date.now()}`;
        io.to(`user:${toUserId}`).emit('call:incoming', {
          callId,
          conversationId,
          callType,
          sdp,
          fromUser: { id: me._id, username: me.username, avatarUrl: me.avatarUrl, isOnline: me.isOnline },
        });
        ack?.({ callId });
      } catch (err) {
        console.error('call:invite error:', err);
        ack?.({ error: 'Failed to place call' });
      }
    });

    // ---- callee accepts ----
    socket.on('call:accept', ({ callId, toUserId, sdp }) => {
      io.to(`user:${toUserId}`).emit('call:accepted', { callId, sdp });
    });

    // ---- callee declines ----
    socket.on('call:decline', ({ callId, toUserId }) => {
      io.to(`user:${toUserId}`).emit('call:declined', { callId });
    });

    // ---- caller cancels before pickup ----
    socket.on('call:cancel', ({ callId, toUserId }) => {
      io.to(`user:${toUserId}`).emit('call:cancelled', { callId });
    });

    // ---- either side ends an active call ----
    socket.on('call:end', ({ callId, toUserId }) => {
      io.to(`user:${toUserId}`).emit('call:ended', { callId });
    });

    // ---- ICE candidate relay ----
    socket.on('call:ice-candidate', ({ toUserId, candidate }) => {
      io.to(`user:${toUserId}`).emit('call:ice-candidate', { candidate });
    });

    // ---- disconnect ----
    socket.on('disconnect', async () => {
      const isNowOffline = removeOnlineSocket(userId, socket.id);
      if (isNowOffline) {
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
        broadcastPresence(io, conversations, userId, false);
      }
    });
  });
}

function broadcastPresence(io, conversations, userId, isOnline) {
  conversations.forEach((c) => {
    io.to(`conversation:${c._id}`).emit('presence:update', { userId, isOnline });
  });
}

// Marks any message this user hadn't received yet (sent while they were
// offline) as delivered now, and lets senders know via message:delivered.
async function catchUpDelivery(io, userId, conversations) {
  const conversationIds = conversations.map((c) => c._id);
  if (conversationIds.length === 0) return;

  const undelivered = await Message.find({
    conversation: { $in: conversationIds },
    sender: { $ne: userId },
    deliveredTo: { $ne: userId },
    deleted: { $ne: true },
  })
    .select('_id conversation')
    .limit(500); // reasonable cap so a long-dormant account doesn't stall on reconnect

  if (undelivered.length === 0) return;

  const ids = undelivered.map((m) => m._id);
  await Message.updateMany({ _id: { $in: ids } }, { $addToSet: { deliveredTo: userId } });

  undelivered.forEach((m) => {
    io.to(`conversation:${m.conversation}`).emit('message:delivered', {
      conversationId: m.conversation,
      messageId: m._id,
      userId,
    });
  });
}

module.exports = { initSockets };
