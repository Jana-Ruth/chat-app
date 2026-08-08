const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // never returned by default
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: 20,
    },
    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300,
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    resetPasswordTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Full profile — only ever sent to the user themselves
userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    avatarUrl: this.avatarUrl,
    phone: this.phone,
    bio: this.bio,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    blockedUsers: this.blockedUsers,
  };
};

// Trimmed profile shown when viewing someone else — no email, no block list
userSchema.methods.toPublicObject = function toPublicObject() {
  return {
    id: this._id,
    username: this.username,
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
  };
};

module.exports = mongoose.model('User', userSchema);
