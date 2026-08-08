import { mediaUrl } from '../utils/media';

export default function Avatar({ user, size = 38, showPresence = false }) {
  const initial = (user?.username || '?').charAt(0).toUpperCase();
  const style = { width: size, height: size, fontSize: size * 0.4 };

  return (
    <div className="avatar" style={style}>
      {user?.avatarUrl ? (
        <img src={mediaUrl(user.avatarUrl)} alt={user.username} />
      ) : (
        <span>{initial}</span>
      )}
      {showPresence && <span className={`presence-dot ${user?.isOnline ? 'online' : ''}`} />}
    </div>
  );
}
