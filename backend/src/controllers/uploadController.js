const { attachmentTypeFor, SUBFOLDERS } = require('../middleware/upload');

// POST /api/uploads - multipart/form-data, field name "file"
// Returns attachment metadata the client then sends via the message:send socket event
function handleUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const type = attachmentTypeFor(req.file.mimetype);
  const folder = SUBFOLDERS[type];

  const attachment = {
    url: `/uploads/${folder}/${req.file.filename}`,
    type,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  };

  res.status(201).json({ attachment });
}

module.exports = { handleUpload };
