const express = require('express');
const {
  searchUsers,
  getProfile,
  updateProfile,
  changePassword,
  blockUser,
  unblockUser,
  listBlocked,
} = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

router.get('/search', searchUsers);
router.get('/me/blocked', listBlocked);
router.put('/me/password', changePassword);
router.put('/me', (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Avatar exceeds 8MB limit' : err.message;
      return res.status(400).json({ error: message });
    }
    next();
  });
}, updateProfile);
router.get('/:id', getProfile);
router.post('/:id/block', blockUser);
router.post('/:id/unblock', unblockUser);

module.exports = router;
