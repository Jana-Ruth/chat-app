import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { getUserProfile, blockUser, unblockUser } from '../api/users';
import { getUserPosts, deletePost as deletePostApi } from '../api/posts';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';

export default function ProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const isOwnProfile = userId === me?.id;

  const [profile, setProfile] = useState(null);
  const [blockedState, setBlockedState] = useState({ iBlockedThem: false, theyBlockedMe: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (isOwnProfile) {
          setProfile(me);
        } else {
          const { user, iBlockedThem, theyBlockedMe } = await getUserProfile(userId);
          if (!cancelled) {
            setProfile(user);
            setBlockedState({ iBlockedThem, theyBlockedMe });
          }
        }
        const userPosts = await getUserPosts(userId);
        if (!cancelled) setPosts(userPosts);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, isOwnProfile, me]);

  async function handleMessage() {
    const { data } = await api.post('/conversations', {
      participantIds: [userId],
      isGroup: false,
    });
    navigate('/', { state: { openConversationId: data.conversation._id } });
  }

  async function handleToggleBlock() {
    setBusy(true);
    try {
      if (blockedState.iBlockedThem) {
        await unblockUser(userId);
        setBlockedState((s) => ({ ...s, iBlockedThem: false }));
      } else {
        await blockUser(userId);
        setBlockedState((s) => ({ ...s, iBlockedThem: true }));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePost(postId) {
    if (!window.confirm('Delete this post?')) return;
    await deletePostApi(postId);
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  }

  if (loading) return <div className="loading">Loading profile...</div>;
  if (error) return <div className="profile-page"><p className="error">{error}</p><Link to="/">← Back</Link></div>;
  if (!profile) return null;

  return (
    <div className="profile-page">
      <Link to="/" className="back-link">← Back to chats</Link>

      <div className="profile-card">
        <Avatar user={profile} size={96} />
        <h1>{profile.username}</h1>
        {!isOwnProfile && (
          <span className={`presence-label ${profile.isOnline ? 'online' : ''}`}>
            {profile.isOnline ? 'Online' : 'Offline'}
          </span>
        )}
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}

        {isOwnProfile && (
          <dl className="profile-details">
            <dt>Email</dt>
            <dd>{profile.email}</dd>
            {profile.phone && (
              <>
                <dt>Phone</dt>
                <dd>{profile.phone}</dd>
              </>
            )}
          </dl>
        )}

        <div className="profile-actions">
          {isOwnProfile ? (
            <Link to="/settings" className="primary-btn">Edit profile</Link>
          ) : blockedState.theyBlockedMe ? (
            <p className="muted-note">You can't message this user</p>
          ) : (
            <>
              <button className="primary-btn" onClick={handleMessage} disabled={blockedState.iBlockedThem}>
                Message
              </button>
              <button className="danger-btn-outline" onClick={handleToggleBlock} disabled={busy}>
                {blockedState.iBlockedThem ? 'Unblock' : 'Block'}
              </button>
            </>
          )}
        </div>
      </div>

      {posts.length > 0 && (
        <div className="profile-posts">
          <h2>Posts</h2>
          <div className="feed-list">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} isOwn={isOwnProfile} onDelete={handleDeletePost} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
