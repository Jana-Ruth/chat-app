import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { uploadFile } from '../api/upload';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext';
import { playKeySound, playSendSound, playReceiveSound } from '../utils/sound';
import { useVoiceRecorder } from '../utils/useVoiceRecorder';
import { dateSeparatorLabel, fullTimestamp, dayKey } from '../utils/dates';
import MessageAttachment from './MessageAttachment';
import MessageTicks from './MessageTicks';
import CallLogEntry from './CallLogEntry';
import BackgroundPicker from './BackgroundPicker';
import GroupInfoPanel from './GroupInfoPanel';
import MessageSearch from './MessageSearch';
import Avatar from './Avatar';
import EmojiStickerTray from './EmojiStickerTray';
import {
  ArrowLeft,
  Image,
  Mic,
  Paperclip,
  Pencil,
  Phone,
  Search,
  Smile,
  Square,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';

function backgroundStorageKey(conversationId) {
  return `chatBg:${conversationId}`;
}

function loadBackground(conversationId) {
  try {
    const raw = localStorage.getItem(backgroundStorageKey(conversationId));
    if (raw) return JSON.parse(raw);
    const fallback = localStorage.getItem('chatBg:default');
    return fallback ? JSON.parse(fallback) : null;
  } catch {
    return null;
  }
}

function backgroundStyle(bg) {
  if (!bg) return {};
  if (bg.type === 'preset' && bg.value === 'default') return {};
  if (bg.type === 'preset') return bg.style || {};
  if (bg.type === 'image') {
    return {
      backgroundImage: `url(${bg.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return {};
}

export default function ChatWindow({ conversation, onConversationUpdated, onLeftGroup, onBack }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { startCall, callState } = useCall();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [pendingUpload, setPendingUpload] = useState(null); // { file, previewUrl, type }
  const [uploading, setUploading] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [emojiTab, setEmojiTab] = useState('emoji');
  const [background, setBackground] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageRefs = useRef(new Map());
  const readSentRef = useRef(new Set());
  const voiceRecorder = useVoiceRecorder();

  const otherParticipant = conversation && !conversation.isGroup
    ? conversation.participants.find((p) => (p.id || p._id) !== user.id)
    : null;
  const otherParticipantIds = conversation
    ? conversation.participants.map((p) => p.id || p._id).filter((id) => id !== user.id)
    : [];

  function markRead(message) {
    if (!socket || !conversation) return;
    const senderId = message.sender._id || message.sender;
    if (senderId === user.id) return;
    const readBy = (message.readBy || []).map(String);
    if (readBy.includes(user.id) || readSentRef.current.has(message._id)) return;
    readSentRef.current.add(message._id);
    socket.emit('message:read', { conversationId: conversation._id, messageId: message._id });
  }

  // load history + saved background when conversation changes
  useEffect(() => {
    if (!conversation) return;
    setMessages([]);
    setPendingUpload(null);
    setEditingId(null);
    setShowEmojiTray(false);
    readSentRef.current = new Set();
    setBackground(loadBackground(conversation._id));
    api.get(`/conversations/${conversation._id}/messages`).then(({ data }) => {
      setMessages(data.messages);
      data.messages.forEach(markRead);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation]);

  // join the conversation's socket room + listen for events
  useEffect(() => {
    if (!socket || !conversation) return;

    socket.emit('conversation:join', conversation._id);

    function handleNewMessage(message) {
      if (message.conversation !== conversation._id) return;
      setMessages((prev) => [...prev, message]);
      const senderId = message.sender._id || message.sender;
      if (senderId !== user.id) {
        playReceiveSound();
        markRead(message);
      }
    }

    function handleEdited(message) {
      if (message.conversation !== conversation._id) return;
      setMessages((prev) => prev.map((m) => (m._id === message._id ? message : m)));
    }

    function handleDeleted({ messageId, conversationId }) {
      if (conversationId !== conversation._id) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, deleted: true, text: '', attachment: null } : m))
      );
    }

    function handleDelivered({ conversationId, messageId, userId }) {
      if (conversationId !== conversation._id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId && !(m.deliveredTo || []).map(String).includes(userId)
            ? { ...m, deliveredTo: [...(m.deliveredTo || []), userId] }
            : m
        )
      );
    }

    function handleRead({ conversationId, messageId, userId }) {
      if (conversationId !== conversation._id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId && !(m.readBy || []).map(String).includes(userId)
            ? { ...m, readBy: [...(m.readBy || []), userId], deliveredTo: [...(m.deliveredTo || []), userId] }
            : m
        )
      );
    }

    function handleTypingStart({ conversationId, userId }) {
      if (conversationId !== conversation._id || userId === user.id) return;
      setTypingUsers((prev) => new Set(prev).add(userId));
    }

    function handleTypingStop({ conversationId, userId }) {
      if (conversationId !== conversation._id) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }

    socket.on('message:new', handleNewMessage);
    socket.on('message:edited', handleEdited);
    socket.on('message:deleted', handleDeleted);
    socket.on('message:delivered', handleDelivered);
    socket.on('message:read', handleRead);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:edited', handleEdited);
      socket.off('message:deleted', handleDeleted);
      socket.off('message:delivered', handleDelivered);
      socket.off('message:read', handleRead);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, conversation, user.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // clean up any object URL created for a local preview
  useEffect(() => {
    return () => {
      if (pendingUpload?.previewUrl) URL.revokeObjectURL(pendingUpload.previewUrl);
    };
  }, [pendingUpload]);

  function handleChange(e) {
    setText(e.target.value);
    playKeySound();
    if (!socket || !conversation) return;

    socket.emit('typing:start', { conversationId: conversation._id });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: conversation._id });
    }, 1500);
  }

  function handleFilePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith('video') ? 'video' : 'image';
    setPendingUpload({ file, previewUrl: URL.createObjectURL(file), type });
    e.target.value = '';
  }

  async function sendMessage({ attachment, sticker } = {}) {
    if (!socket || !conversation) return;
    const trimmed = text.trim();
    if (!trimmed && !attachment && !sticker) return;

    socket.emit('message:send', { conversationId: conversation._id, text: sticker ? '' : trimmed, attachment, sticker }, (res) => {
      if (res?.error) console.error(res.error);
      else playSendSound();
    });
    if (!sticker) setText('');
    socket.emit('typing:stop', { conversationId: conversation._id });
  }

  async function handleSend(e) {
    e.preventDefault();

    if (pendingUpload) {
      setUploading(true);
      try {
        const attachment = await uploadFile(pendingUpload.file);
        await sendMessage({ attachment });
        setPendingUpload(null);
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        setUploading(false);
      }
      return;
    }

    sendMessage();
  }

  function handleEmojiSelect(emoji) {
    setText((value) => `${value}${emoji}`);
  }

  function handleStickerSend(sticker) {
    sendMessage({ sticker });
    setShowEmojiTray(false);
  }

  async function handleVoiceToggle() {
    if (voiceRecorder.recording) {
      const result = await voiceRecorder.stop();
      if (!result) return;
      setUploading(true);
      try {
        const filename = `voice-note.${result.mimeType.includes('mp4') ? 'm4a' : 'webm'}`;
        const attachment = await uploadFile(result.blob, filename);
        attachment.duration = result.duration;
        await sendMessage({ attachment });
      } catch (err) {
        console.error('Voice note upload failed:', err);
      } finally {
        setUploading(false);
      }
    } else {
      try {
        await voiceRecorder.start();
      } catch (err) {
        console.error('Microphone access denied or unavailable:', err);
      }
    }
  }

  function handleBackgroundSelect(bg) {
    setBackground(bg);
    localStorage.setItem(backgroundStorageKey(conversation._id), JSON.stringify(bg));
    setShowBgPicker(false);
  }

  function startEdit(message) {
    setEditingId(message._id);
    setEditText(message.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  function saveEdit(messageId) {
    if (!editText.trim() || !socket) return;
    socket.emit('message:edit', { messageId, text: editText.trim() }, (res) => {
      if (res?.error) console.error(res.error);
    });
    setEditingId(null);
    setEditText('');
  }

  function handleDelete(messageId) {
    if (!socket) return;
    if (!window.confirm('Delete this message? This cannot be undone.')) return;
    socket.emit('message:delete', { messageId }, (res) => {
      if (res?.error) console.error(res.error);
    });
  }

  function handleJumpToMessage(messageId) {
    const el = messageRefs.current.get(messageId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(messageId);
    setTimeout(() => setHighlightedId(null), 2000);
  }

  function handleCall(callType) {
    if (!otherParticipant || callState !== 'idle') return;
    startCall(conversation._id, otherParticipant, callType);
  }

  if (!conversation) {
    return <div className="chat-window empty">Select a conversation to start chatting</div>;
  }

  let lastDayKey = null;

  return (
    <div className="chat-window" style={backgroundStyle(background)}>
      <div className="chat-window-header">
        <button className="mobile-chat-back" type="button" onClick={onBack} title="Back to chats">
          <ArrowLeft size={18} />
        </button>
        {conversation.isGroup ? (
          <button className="chat-header-title" onClick={() => setShowGroupPanel(true)}>
            <span className="avatar" style={{ width: 34, height: 34, fontSize: 14 }}><Users size={16} /></span>
            {conversation.name}
          </button>
        ) : (
          <Link to={`/profile/${otherParticipant?.id || otherParticipant?._id}`} className="chat-header-title">
            <Avatar user={otherParticipant} size={34} showPresence />
            <span className="chat-header-name-block">
              <span className="chat-header-name">{otherParticipant?.username}</span>
              <span className="chat-header-status">{otherParticipant?.isOnline ? 'Online' : 'Offline'}</span>
            </span>
          </Link>
        )}
        <div className="chat-header-actions">
          {!conversation.isGroup && (
            <>
              <button
                className="icon-toggle"
                title="Voice call"
                onClick={() => handleCall('audio')}
                disabled={callState !== 'idle'}
              >
                <Phone size={17} />
              </button>
              <button
                className="icon-toggle"
                title="Video call"
                onClick={() => handleCall('video')}
                disabled={callState !== 'idle'}
              >
                <Video size={17} />
              </button>
            </>
          )}
          <button className="icon-toggle" title="Search messages" onClick={() => setShowSearch(true)}><Search size={17} /></button>
          <button className="icon-toggle" title="Chat background" onClick={() => setShowBgPicker(true)}><Image size={17} /></button>
        </div>
      </div>

      {showBgPicker && (
        <BackgroundPicker onSelect={handleBackgroundSelect} onClose={() => setShowBgPicker(false)} />
      )}

      {showGroupPanel && conversation.isGroup && (
        <GroupInfoPanel
          conversation={conversation}
          onClose={() => setShowGroupPanel(false)}
          onUpdated={(conv) => {
            onConversationUpdated(conv);
            setShowGroupPanel(false);
          }}
          onLeft={() => {
            setShowGroupPanel(false);
            onLeftGroup(conversation._id);
          }}
        />
      )}

      {showSearch && (
        <MessageSearch
          conversationId={conversation._id}
          loadedMessageIds={new Set(messages.map((m) => m._id))}
          onJump={handleJumpToMessage}
          onClose={() => setShowSearch(false)}
        />
      )}

      <div className="messages">
        {messages.map((m) => {
          const isMine = m.sender._id === user.id || m.sender === user.id;
          const isEditing = editingId === m._id;
          const key = dayKey(m.createdAt);
          const showDateSeparator = key !== lastDayKey;
          lastDayKey = key;

          if (m.call?.callType) {
            return (
              <div key={m._id}>
                {showDateSeparator && (
                  <div className="date-separator"><span>{dateSeparatorLabel(m.createdAt)}</span></div>
                )}
                <CallLogEntry call={m.call} />
              </div>
            );
          }

          return (
            <div key={m._id}>
              {showDateSeparator && (
                <div className="date-separator"><span>{dateSeparatorLabel(m.createdAt)}</span></div>
              )}
              <div
                ref={(el) => {
                  if (el) messageRefs.current.set(m._id, el);
                  else messageRefs.current.delete(m._id);
                }}
                className={`message ${isMine ? 'mine' : ''} ${highlightedId === m._id ? 'highlighted' : ''}`}
              >
                {conversation.isGroup && !isMine && <div className="sender-name">{m.sender.username}</div>}

                {m.deleted ? (
                  <div className="bubble deleted-bubble">This message was deleted</div>
                ) : isEditing ? (
                  <div className="edit-box">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => saveEdit(m._id)}>Save</button>
                    <button onClick={cancelEdit}>Cancel</button>
                  </div>
                ) : (
                  <>
                    {m.attachment?.url && <MessageAttachment attachment={m.attachment} />}
                    {m.sticker?.emoji && (
                      <div className="sticker-message" style={{ '--sticker-accent': m.sticker.accent || '#6C4CF1' }}>
                        <span>{m.sticker.emoji}</span>
                        <small>{m.sticker.label}</small>
                      </div>
                    )}
                    {m.text && <div className="bubble">{m.text}</div>}
                  </>
                )}

                <span className="msg-time" title={fullTimestamp(m.createdAt)}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {m.edited && !m.deleted && ' - edited'}
                  {isMine && !m.deleted && (
                    <MessageTicks message={m} otherParticipantIds={otherParticipantIds} />
                  )}
                </span>

                {isMine && !m.deleted && !isEditing && (
                  <div className="message-actions">
                    {m.text && !m.attachment?.url && (
                      <button onClick={() => startEdit(m)} title="Edit"><Pencil size={13} /></button>
                    )}
                    <button onClick={() => handleDelete(m._id)} title="Delete"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {typingUsers.size > 0 && (
        <div className="typing-indicator">
          <span className="typing-wave">
            <span></span><span></span><span></span>
          </span>
          typing
        </div>
      )}

      {pendingUpload && (
        <div className="pending-upload">
          {pendingUpload.type === 'image' ? (
            <img src={pendingUpload.previewUrl} alt="preview" />
          ) : (
            <video src={pendingUpload.previewUrl} controls />
          )}
          <button onClick={() => setPendingUpload(null)}><X size={14} /> Remove</button>
        </div>
      )}

      {showEmojiTray && (
        <EmojiStickerTray
          activeTab={emojiTab}
          onTabChange={setEmojiTab}
          onEmoji={handleEmojiSelect}
          onSticker={handleStickerSend}
        />
      )}

      <form className="message-input" onSubmit={handleSend}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={handleFilePick}
        />
        <button
          type="button"
          className={`icon-btn ${showEmojiTray ? 'active' : ''}`}
          title="Emoji and stickers"
          onClick={() => setShowEmojiTray((open) => !open)}
          disabled={uploading || voiceRecorder.recording}
        >
          <Smile size={18} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="Attach image or video"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || voiceRecorder.recording}
        >
          <Paperclip size={18} />
        </button>

        <button
          type="button"
          className={`icon-btn ${voiceRecorder.recording ? 'recording' : ''}`}
          title={voiceRecorder.recording ? 'Stop recording' : 'Record voice note'}
          onClick={handleVoiceToggle}
          disabled={uploading}
        >
          {voiceRecorder.recording ? <><Square size={14} /> {voiceRecorder.seconds}s</> : <Mic size={18} />}
        </button>

        <input
          type="text"
          placeholder={voiceRecorder.recording ? 'Recording voice note...' : 'Type a message...'}
          value={text}
          onChange={handleChange}
          disabled={voiceRecorder.recording}
        />
        <button type="submit" disabled={uploading || voiceRecorder.recording}>
          {uploading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
