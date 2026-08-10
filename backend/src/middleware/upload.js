const multer = require('multer');

// image / video / audio (voice notes) / avatars each get their own Cloudinary folder
const SUBFOLDERS = {
  image: 'images',
  video: 'videos',
  audio: 'audio',
  avatar: 'avatars',
};

const ALLOWED_MIME = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'audio/webm': 'audio',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/ogg': 'audio',
  'audio/wav': 'audio',
};

const ALLOWED_AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME[file.mimetype]) {
    return cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB cap for photos, voice notes, and short clips
  },
});

// Separate, smaller-limit uploader just for profile pictures
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter(req, file, cb) {
    if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
      return cb(new Error(`Unsupported image type: ${file.mimetype}`));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB for profile pictures
  },
});

function attachmentTypeFor(mimetype) {
  return ALLOWED_MIME[mimetype] || null;
}

module.exports = { upload, avatarUpload, attachmentTypeFor, SUBFOLDERS };
