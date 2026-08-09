const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    isGroup: {
      type: Boolean,
      default: false,
    },
    name: {
      // only used for group conversations
      type: String,
      trim: true,
      default: '',
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    admins: [
      {
        // only relevant for group conversations
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    clearedFor: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        clearedAt: {
          type: Date,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

// Speed up "find my conversations" queries
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);