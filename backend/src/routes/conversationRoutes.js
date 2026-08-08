const express = require('express');
const {
  listConversations,
  createConversation,
  addParticipant,
  removeParticipant,
  leaveConversation,
} = require('../controllers/conversationController');
const { getMessages, searchMessages } = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', listConversations);
router.post('/', createConversation);
router.post('/:id/participants', addParticipant);
router.delete('/:id/participants/:userId', removeParticipant);
router.post('/:id/leave', leaveConversation);
router.get('/:id/messages', getMessages);
router.get('/:id/messages/search', searchMessages);

module.exports = router;
