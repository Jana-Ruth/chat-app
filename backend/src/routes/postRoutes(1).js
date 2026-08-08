const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { createPost, getFeed, getUserPosts, deletePost } = require('../controllers/postController');

const router = express.Router();

router.use(requireAuth);

router.post('/', (req, res, next) => {
  upload.single('media')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds 50MB limit' : err.message;
      return res.status(400).json({ error: message });
    }
    next();
  });
}, createPost);

router.get('/feed', getFeed);
router.get('/user/:userId', getUserPosts);
router.delete('/:id', deletePost);

module.exports = router;
