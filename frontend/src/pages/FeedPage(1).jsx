import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFeed, deletePost as deletePostApi } from '../api/posts';
import PostCard from '../components/PostCard';
import PostComposer from '../components/PostComposer';

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    getFeed()
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(post) {
    setPosts((prev) => [post, ...prev]);
    setShowComposer(false);
  }

  async function handleDelete(postId) {
    if (!window.confirm('Delete this post?')) return;
    await deletePostApi(postId);
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  }

  return (
    <div className="feed-page">
      <div className="feed-header">
        <Link to="/" className="back-link">← Back to chats</Link>
        <button className="primary-btn" onClick={() => setShowComposer(true)}>+ New post</button>
      </div>

      <h1 className="feed-title">Posts</h1>

      {loading ? (
        <div className="loading">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="feed-empty">
          <p>No posts yet.</p>
          <p className="muted-note">Share a photo or video, or wait for your contacts to post something.</p>
        </div>
      ) : (
        <div className="feed-list">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              isOwn={(post.author.id || post.author._id) === user.id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showComposer && (
        <PostComposer onClose={() => setShowComposer(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
