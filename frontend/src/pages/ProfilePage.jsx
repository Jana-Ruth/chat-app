import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { getUserProfile, blockUser, unblockUser } from '../api/users';
import { getUserPosts, deletePost as deletePostApi } from '../api/posts';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import { ArrowLeft, Ban, Mail, MessageCircle, Phone, Settings, Shield, X } from 'lucide-react';

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
  const [activeModal, setActiveModal] = useState(null);

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
    if (!window.confirm('Delete this status update?')) return;
    await deletePostApi(postId);
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  }

  if (loading) return <div className="loading">Loading profile...</div>;
  if (error) return <div className="profile-page"><p className="error">{error}</p><Link to="/">Back</Link></div>;
  if (!profile) return null;

  return (
    <div className="profile-page">
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to chats</Link>

      <section className="profile-hero">
        <div className="profile-hero-bg" />
        <div className="profile-identity">
          <Avatar user={profile} size={112} />
          <div>
            <span className={`presence-label ${profile.isOnline ? 'online' : ''}`}>
              {profile.isOnline ? 'Online now' : 'Offline'}
            </span>
            <h1>{profile.username}</h1>
            <p className="profile-bio">{profile.bio || 'No bio added yet.'}</p>
          </div>
        </div>

        <div className="profile-stats-row">
          <button onClick={() => setActiveModal('details')}>
            <strong>{posts.length}</strong>
            <span>Status updates</span>
          </button>
          <button onClick={() => setActiveModal('details')}>
            <strong>{profile.phone ? 'Yes' : 'No'}</strong>
            <span>Phone</span>
          </button>
          <button onClick={() => setActiveModal('details')}>
            <strong>{isOwnProfile ? 'Owner' : 'Contact'}</strong>
            <span>Profile type</span>
          </button>
        </div>

        <div className="profile-actions">
          {isOwnProfile ? (
            <Link to="/settings" className="primary-btn"><Settings size={16} /> Edit profile</Link>
          ) : blockedState.theyBlockedMe ? (
            <p className="muted-note">You can't message this user</p>
          ) : (
            <>
              <button className="primary-btn" onClick={handleMessage} disabled={blockedState.iBlockedThem}>
                <MessageCircle size={16} />
                Message
              </button>
              <button className="secondary-btn" onClick={() => setActiveModal('details')}>
                <Shield size={16} />
                Details
              </button>
              <button className="danger-btn-outline" onClick={() => setActiveModal('safety')} disabled={busy}>
                <Ban size={16} />
                Safety
              </button>
            </>
          )}
        </div>
      </section>

      <section className="profile-posts">
        <div className="section-heading-row">
          <h2>Status</h2>
          <span>{posts.length} updates</span>
        </div>
        {posts.length > 0 ? (
          <div className="feed-list">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} isOwn={isOwnProfile} onDelete={handleDeletePost} />
            ))}
          </div>
        ) : (
          <div className="feed-empty">
            <p>No status updates yet.</p>
          </div>
        )}
      </section>

      {activeModal === 'details' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Profile details</h2>
              <button onClick={() => setActiveModal(null)}><X size={18} /></button>
            </div>
            <dl className="profile-details">
              {isOwnProfile && (
                <>
                  <dt><Mail size={14} /> Email</dt>
                  <dd>{profile.email}</dd>
                </>
              )}
              <dt><Phone size={14} /> Phone</dt>
              <dd>{profile.phone || 'Not set'}</dd>
              <dt><Shield size={14} /> Visibility</dt>
              <dd>{isOwnProfile ? 'This is your account' : blockedState.iBlockedThem ? 'Blocked by you' : 'Available contact'}</dd>
            </dl>
          </div>
        </div>
      )}

      {activeModal === 'safety' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Safety controls</h2>
              <button onClick={() => setActiveModal(null)}><X size={18} /></button>
            </div>
            <p className="muted-note">Control whether this person can message you.</p>
            <button className="danger-btn-outline modal-wide-action" onClick={handleToggleBlock} disabled={busy}>
              <Ban size={16} />
              {blockedState.iBlockedThem ? 'Unblock this user' : 'Block this user'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
