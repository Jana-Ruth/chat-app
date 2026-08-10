const Post = require('../models/Post');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { uploadBuffer } = require('../config/cloudinary');
const { attachmentTypeFor } = require('../middleware/upload');

// ids of users blocked-in-either-direction relative to the viewer
async function getBlockedIds(viewerId) {
  const me = await User.findById(viewerId).select('blockedUsers');
  const whoBlockedMe = await User.find({ blockedUsers: viewerId }).select('_id');
  return new Set([...(me?.blockedUsers || []).map(String), ...whoBlockedMe.map((u) => u._id.toString())]);
}

// ids of everyone the viewer shares at least one conversation with
async function getContactIds(viewerId) {
  const conversations = await Conversation.find({ participants: viewerId }).select('participants');
  const ids = new Set();
  conversations.forEach((c) => {
    c.participants.forEach((p) => {
      const id = p.toString();
      if (id !== viewerId) ids.add(id);
    });
  });
  return ids;
}

function canView(post, viewerId, contactIds) {
  const authorId = post.author._id ? post.author._id.toString() : post.author.toString();
  if (authorId === viewerId) return true;
  if (post.visibility === 'everyone') return true;
  if (post.visibility === 'contacts') return contactIds.has(authorId);
  if (post.visibility === 'custom') return post.visibleTo.some((id) => id.toString() === viewerId);
  return false;
}

// POST /api/posts - multipart, field name "media"
async function createPost(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'A photo or video is required' });

    const type = attachmentTypeFor(req.file.mimetype);
    if (type !== 'image' && type !== 'video') {
      return res.status(400).json({ error: 'Only images and videos are supported for posts' });
    }

    const { caption, visibility } = req.body;
    let visibleTo = [];
    if (visibility === 'custom' && req.body.visibleTo) {
      try {
        visibleTo = JSON.parse(req.body.visibleTo);
        if (!Array.isArray(visibleTo)) visibleTo = [];
      } catch {
        visibleTo = [];
      }
    }

    const folder = type === 'image' ? 'images' : 'videos';
    const media = await uploadBuffer(req.file, { folder, type });
    const post = await Post.create({
      author: req.userId,
      mediaUrl: media.secure_url,
      mediaType: type,
      caption: (caption || '').trim().slice(0, 1000),
      visibility: ['everyone', 'contacts', 'custom'].includes(visibility) ? visibility : 'contacts',
      visibleTo: visibility === 'custom' ? visibleTo : [],
    });

    const populated = await post.populate('author', 'username avatarUrl');
    res.status(201).json({ post: populated });
  } catch (err) {
    console.error('createPost error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
}

// GET /api/posts/feed - posts from other people, visibility-filtered
async function getFeed(req, res) {
  const blockedIds = await getBlockedIds(req.userId);
  const contactIds = await getContactIds(req.userId);

  const posts = await Post.find({ author: { $nin: Array.from(blockedIds) } })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('author', 'username avatarUrl');

  const visible = posts.filter((p) => canView(p, req.userId, contactIds));
  res.json({ posts: visible });
}

// GET /api/posts/user/:userId - one user's posts, visibility-filtered for the viewer
async function getUserPosts(req, res) {
  const { userId } = req.params;

  const blockedIds = await getBlockedIds(req.userId);
  if (blockedIds.has(userId)) return res.json({ posts: [] });

  const contactIds = userId === req.userId ? new Set() : await getContactIds(req.userId);

  const posts = await Post.find({ author: userId })
    .sort({ createdAt: -1 })
    .populate('author', 'username avatarUrl');

  const visible = posts.filter((p) => canView(p, req.userId, contactIds));
  res.json({ posts: visible });
}

// DELETE /api/posts/:id - author only
async function deletePost(req, res) {
  const { id } = req.params;
  const post = await Post.findById(id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author.toString() !== req.userId) {
    return res.status(403).json({ error: 'You can only delete your own posts' });
  }
  await post.deleteOne();
  res.json({ success: true });
}

module.exports = { createPost, getFeed, getUserPosts, deletePost };



