import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

export default function GroupInfoPanel({ conversation, onClose, onUpdated, onLeft }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = conversation.admins?.some((a) => (a.id || a._id || a) === user.id || a === user.id);
  const memberIds = new Set(conversation.participants.map((p) => p.id || p._id));

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      const { data } = await api.get('/users/search', { params: { q: query } });
      setResults(data.users.filter((u) => !memberIds.has(u.id || u._id)));
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function handleAdd(targetUser) {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/conversations/${conversation._id}/participants`, {
        userId: targetUser.id || targetUser._id,
      });
      onUpdated(data.conversation);
      setQuery('');
      setResults([]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(memberId) {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.delete(`/conversations/${conversation._id}/participants/${memberId}`);
      onUpdated(data.conversation);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/conversations/${conversation._id}/leave`);
      onLeft();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to leave group');
      setBusy(false);
    }
  }

  return (
    <div className="bg-picker-overlay" onClick={onClose}>
      <div className="group-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bg-picker-header">
          <span>{conversation.name}</span>
          <button onClick={onClose}>✕</button>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="group-members">
          {conversation.participants.map((p) => {
            const id = p.id || p._id;
            const memberIsAdmin = conversation.admins?.some((a) => (a.id || a._id || a) === id);
            return (
              <div className="group-member-row" key={id}>
                <Avatar user={p} size={30} />
                <span className="group-member-name">
                  {p.username} {id === user.id && '(you)'}
                </span>
                {memberIsAdmin && <span className="admin-badge">admin</span>}
                {isAdmin && id !== user.id && (
                  <button className="remove-member-btn" disabled={busy} onClick={() => handleRemove(id)}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {isAdmin && (
          <div className="group-add-block">
            <input
              type="text"
              placeholder="Add member..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {results.length > 0 && (
              <ul className="search-results">
                {results.map((u) => (
                  <li key={u.id || u._id}>
                    <button disabled={busy} onClick={() => handleAdd(u)}>+ {u.username}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button className="leave-group-btn" onClick={handleLeave} disabled={busy}>
          Leave group
        </button>
      </div>
    </div>
  );
}
