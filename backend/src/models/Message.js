const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    attachment: {
      url: { type: String, default: null },
      type: { type: String, enum: ['image', 'video', 'audio', null], default: null },
      fileName: { type: String, default: null },
      mimeType: { type: String, default: null },
      size: { type: Number, default: null }, // bytes
      duration: { type: Number, default: null }, // seconds, for audio/video
    },
    sticker: {
      id: { type: String, default: null },
      label: { type: String, default: null },
      emoji: { type: String, default: null },
      accent: { type: String, default: null },
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // present only for call-log entries (e.g. "Voice call · 3:24")
    call: {
      callType: { type: String, enum: ['audio', 'video', null], default: null },
      status: { type: String, enum: ['completed', 'missed', 'declined', null], default: null },
      duration: { type: Number, default: null }, // seconds
    },
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, text: 'text' });

// A message must carry text, an attachment, or be a call-log entry — a
// soft-deleted message legitimately has none of those, so skip the check then.
messageSchema.pre('validate', function requireContent(next) {
  if (this.deleted) return next();
  const hasText = this.text && this.text.trim().length > 0;
  const hasAttachment = this.attachment && this.attachment.url;
  const hasSticker = this.sticker && this.sticker.emoji;
  const hasCall = this.call && this.call.callType;
  if (!hasText && !hasAttachment && !hasSticker && !hasCall) {
    return next(new Error('Message must have text, an attachment, sticker, or a call log'));
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);
