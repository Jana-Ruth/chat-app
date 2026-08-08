import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFeed, deletePost as deletePostApi } from '../api/posts';
import { mediaUrl } from '../utils/media';
import { fullTimestamp } from '../utils/dates';
import Avatar from '../components/Avatar';
import PostComposer from '../components/PostComposer';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Plus,
  Trash2,
} from 'lucide-react';

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);

  useEffect(() => {
    getFeed()
      .then((items) => {
        setPosts(items);
        setActiveIndex(0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'ArrowLeft') goPrevious();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const activePost = posts[activeIndex] || null;
  const grouped = useMemo(() => {
    return posts.reduce((acc, post, index) => {
      const id = post.author.id || post.author._id;
      if (!acc.has(id)) acc.set(id, { author: post.author, items: [] });
      acc.get(id).items.push({ post, index });
      return acc;
    }, new Map());
  }, [posts]);

  function goPrevious() {
    setActiveIndex((idx) => (posts.length ? (idx - 1 + posts.length) % posts.length : 0));
  }

  function goNext() {
    setActiveIndex((idx) => (posts.length ? (idx + 1) % posts.length : 0));
  }

  function handleCreated(post) {
    setPosts((prev) => [post, ...prev]);
    setActiveIndex(0);
    setShowComposer(false);
  }

  async function handleDelete(postId) {
    if (!window.confirm('Delete this status update?')) return;
    await deletePostApi(postId);
    setPosts((prev) => {
      const next = prev.filter((p) => p._id !== postId);
      setActiveIndex((idx) => Math.min(idx, Math.max(next.length - 1, 0)));
      return next;
    });
  }

  function handleTouchEnd(e) {
    if (touchStart === null) return;
    const delta = e.changedTouches[0].clientX - touchStart;
    setTouchStart(null);
    if (Math.abs(delta) < 45) return;
    if (delta > 0) goPrevious();
    else goNext();
  }

  return (
    <div className="feed-page status-page">
      <div className="feed-header status-topbar">
        <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to chats</Link>
        <button className="primary-btn" onClick={() => setShowComposer(true)}><Plus size={16} /> Add status</button>
      </div>

      <div className="status-title-block">
        <span>Status</span>
        <h1>Moments from your circle</h1>
      </div>

      {loading ? (
        <div className="loading">Loading status...</div>
      ) : posts.length === 0 ? (
        <div className="feed-empty status-empty">
          <Eye size={28} />
          <p>No status updates yet.</p>
          <p className="muted-note">Share a photo or video, or see what your contacts are up to.</p>
        </div>
      ) : (
        <div className="status-shell">
          <aside className="status-rail">
            {Array.from(grouped.values()).map((group) => (
              <div className="status-rail-group" key={group.author.id || group.author._id}>
                <div className="status-rail-author">
                  <Avatar user={group.author} size={36} />
                  <div>
                    <strong>{group.author.username}</strong>
                    <span>{group.items.length} update{group.items.length > 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="status-thumb-row">
                  {group.items.map(({ post, index }) => (
                    <button
                      key={post._id}
                      className={`status-thumb ${index === activeIndex ? 'active' : ''}`}
                      onClick={() => setActiveIndex(index)}
                      title={fullTimestamp(post.createdAt)}
                    >
                      {post.mediaType === 'video' ? (
                        <video src={mediaUrl(post.mediaUrl)} muted />
                      ) : (
                        <img src={mediaUrl(post.mediaUrl)} alt="" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>

          <main
            className="status-viewer"
            onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
            onTouchEnd={handleTouchEnd}
          >
            <div className="status-progress">
              {posts.map((post, index) => (
                <button
                  key={post._id}
                  className={index === activeIndex ? 'active' : ''}
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Open status ${index + 1}`}
                />
              ))}
            </div>

            <div className="status-viewer-header">
              <div className="status-author">
                <Avatar user={activePost.author} size={42} />
                <div>
                  <strong>{activePost.author.username}</strong>
                  <span><Clock size={13} /> {fullTimestamp(activePost.createdAt)}</span>
                </div>
              </div>
              {(activePost.author.id || activePost.author._id) === user.id && (
                <button className="status-delete" onClick={() => handleDelete(activePost._id)} title="Delete status">
                  <Trash2 size={17} />
                </button>
              )}
            </div>

            <button className="status-nav prev" onClick={goPrevious} title="Previous status">
              <ChevronLeft size={26} />
            </button>
            <div className="status-media-stage">
              {activePost.mediaType === 'video' ? (
                <video src={mediaUrl(activePost.mediaUrl)} controls autoPlay />
              ) : (
                <img src={mediaUrl(activePost.mediaUrl)} alt={activePost.caption || 'Status'} />
              )}
            </div>
            <button className="status-nav next" onClick={goNext} title="Next status">
              <ChevronRight size={26} />
            </button>

            {activePost.caption && <p className="status-caption">{activePost.caption}</p>}
          </main>
        </div>
      )}

      {showComposer && (
        <PostComposer onClose={() => setShowComposer(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
