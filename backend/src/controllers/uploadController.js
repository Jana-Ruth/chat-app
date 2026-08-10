const { uploadBuffer } = require('../config/cloudinary');
const { attachmentTypeFor, SUBFOLDERS } = require('../middleware/upload');

// POST /api/uploads - multipart/form-data, field name "file"
// Returns attachment metadata the client then sends via the message:send socket event
async function handleUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const type = attachmentTypeFor(req.file.mimetype);
    const folder = SUBFOLDERS[type];
    const result = await uploadBuffer(req.file, { folder, type });

    const attachment = {
      url: result.secure_url,
      publicId: result.public_id,
      type,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    };

    res.status(201).json({ attachment });
  } catch (err) {
    console.error('handleUpload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload file' });
  }
}

module.exports = { handleUpload };
