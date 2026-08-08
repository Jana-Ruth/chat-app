const express = require('express');
const { register, login, me, forgotPassword, resetPassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');

const router = express.Router();

router.post('/register', (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Avatar exceeds 8MB limit' : err.message;
      return res.status(400).json({ error: message });
    }
    next();
  });
}, register);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
