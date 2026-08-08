const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

// image / video / audio (voice notes) / avatars each get their own subfolder
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

// Make sure upload directories exist before multer tries to write to them
Object.values(SUBFOLDERS).forEach((folder) => {
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const kind = ALLOWED_MIME[file.mimetype];
    if (!kind) return cb(new Error('Unsupported file type'));
    cb(null, path.join(UPLOAD_ROOT, SUBFOLDERS[kind]));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME[file.mimetype]) {
    return cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB cap — plenty for photos, voice notes, short clips
  },
});

// Separate, smaller-limit uploader just for profile pictures
const avatarStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(UPLOAD_ROOT, SUBFOLDERS.avatar));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter(req, file, cb) {
    if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
      return cb(new Error(`Unsupported image type: ${file.mimetype}`));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB — profile pictures don't need to be huge
  },
});

function attachmentTypeFor(mimetype) {
  return ALLOWED_MIME[mimetype] || null;
}

module.exports = { upload, avatarUpload, attachmentTypeFor, SUBFOLDERS, UPLOAD_ROOT };
