const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      required: true,
    },
    caption: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    // 'everyone' = any non-blocked user; 'contacts' = only people you share a
    // conversation with; 'custom' = a hand-picked list in visibleTo
    visibility: {
      type: String,
      enum: ['everyone', 'contacts', 'custom'],
      default: 'contacts',
    },
    visibleTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
