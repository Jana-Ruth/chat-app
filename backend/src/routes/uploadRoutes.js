const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { handleUpload } = require('../controllers/uploadController');

const router = express.Router();

router.post('/', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds 50MB limit' : err.message;
      return res.status(400).json({ error: message });
    }
    handleUpload(req, res);
  });
});

module.exports = router;
