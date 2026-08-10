import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { soundsEnabled, setSoundsEnabled } from '../utils/sound';
import Avatar from './Avatar';
import {
  Image,
  LogOut,
  MessageCircle,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';

export default function Sidebar({ conversations, activeId, onSelect, onConversationCreated }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [soundsOn, setSoundsOn] = useState(soundsEnabled());

  function toggleSounds() {
    const next = !soundsOn;
    setSoundsOn(next);
    setSoundsEnabled(next);
  }

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      const { data } = await api.get('/users/search', { params: { q: query } });
      setResults(data.users);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function startDirectChat(targetUser) {
    try {
      const { data } = await api.post('/conversations', {
        participantIds: [targetUser.id || targetUser._id],
        isGroup: false,
      });
      onConversationCreated(data.conversation);
      setQuery('');
      setResults([]);
    } catch (err) {
      console.error(err.response?.data?.error || 'Failed to start conversation');
    }
  }

  function toggleUserSelection(u) {
    const id = u.id || u._id;
    setSelectedUsers((prev) =>
      prev.some((p) => (p.id || p._id) === id) ? prev.filter((p) => (p.id || p._id) !== id) : [...prev, u]
    );
  }

  async function createGroup() {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    const { data } = await api.post('/conversations', {
      participantIds: selectedUsers.map((u) => u.id || u._id),
      isGroup: true,
      name: groupName.trim(),
    });
    onConversationCreated(data.conversation);
    setGroupMode(false);
    setGroupName('');
    setSelectedUsers([]);
    setQuery('');
    setResults([]);
  }

  function previewText(lastMessage) {
    if (!lastMessage) return '';
    if (lastMessage.deleted) return 'This message was deleted';
    if (lastMessage.text) return lastMessage.text;
    if (lastMessage.sticker?.emoji) return `${lastMessage.sticker.emoji} Sticker`;
    const type = lastMessage.attachment?.type;
    if (type === 'image') return 'Photo';
    if (type === 'video') return 'Video';
    if (type === 'audio') return 'Voice note';
    return '';
  }

  function otherParticipant(conv) {
    if (conv.isGroup) return null;
    return conv.participants.find((p) => (p.id || p._id) !== user.id);
  }

  function conversationLabel(conv) {
    if (conv.isGroup) return conv.name;
    return otherParticipant(conv)?.username || 'Unknown user';
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="wordmark">Jana</span>
        <span className="sidebar-kicker">Secure messaging</span>
      </div>

      <div className="sidebar-user-row">
        <Link to={`/profile/${user?.id}`} className="sidebar-me">
          <Avatar user={user} size={32} />
          <span className="username-pill">{user?.username}</span>
        </Link>
        <div className="sidebar-user-actions">
          <Link to="/settings" className="icon-toggle" title="Settings">
            <Settings size={17} />
          </Link>
        </div>
      </div>

      <div className="search-block">
        <div className="search-input-wrap">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search people..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="link-btn" onClick={() => setGroupMode((v) => !v)}>
          <Users size={14} />
          {groupMode ? 'Cancel group' : 'New group'}
        </button>

        {results.length > 0 && (
          <ul className="search-results">
            {results.map((u) => (
              <li key={u.id || u._id}>
                {groupMode ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedUsers.some((s) => (s.id || s._id) === (u.id || u._id))}
                      onChange={() => toggleUserSelection(u)}
                    />
                    {u.username}
                  </label>
                ) : (
                  <div className="search-result-row">
                    <Link to={`/profile/${u.id || u._id}`} className="search-result-name">
                      {u.username}
                    </Link>
                    <button onClick={() => startDirectChat(u)}>
                      <MessageCircle size={14} />
                      Message
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {groupMode && (
          <div className="group-form">
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <button onClick={createGroup} disabled={!groupName.trim() || selectedUsers.length === 0}>
              Create group ({selectedUsers.length})
            </button>
          </div>
        )}
      </div>

      <ul className="conversation-list">
        {conversations.map((conv) => {
          const other = otherParticipant(conv);
          return (
            <li
              key={conv._id}
              className={conv._id === activeId ? 'active' : ''}
              onClick={() => onSelect(conv)}
            >
              {conv.isGroup ? (
                <div className="avatar" style={{ width: 38, height: 38, fontSize: 15 }}>#</div>
              ) : (
                <Avatar user={other} showPresence />
              )}
              <div className="conv-body">
                <div className="conv-name">{conversationLabel(conv)}</div>
                {conv.lastMessage && (
                  <div className="conv-preview">
                    {conv.lastMessage.sender?.username}: {previewText(conv.lastMessage)}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sidebar-bottom-dock">
        <Link to="/" className="dock-item active" title="Chats">
          <MessageCircle size={18} />
          <span>Chats</span>
        </Link>
        <Link to="/feed" className="dock-item" title="Status">
          <Image size={18} />
          <span>Status</span>
        </Link>
        <button className="dock-item" title="Toggle theme" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
        <button className="dock-item" title="Toggle sounds" onClick={toggleSounds}>
          {soundsOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span>Sound</span>
        </button>
        <button className="dock-item danger" onClick={logout} title="Log out">
          <LogOut size={18} />
          <span>Exit</span>
        </button>
      </div>
    </aside>
  );
}

