import { Laugh, Sticker } from 'lucide-react';

const EMOJI_GROUPS = [
  {
    label: 'Smileys',
    items: ['😀', '😄', '😂', '😊', '😍', '😘', '😎', '🥳', '😢', '😭', '😡', '😴'],
  },
  {
    label: 'Gestures',
    items: ['👍', '👎', '👏', '🙏', '🤝', '💪', '🙌', '👀', '✌️', '🤌', '👌', '🫶'],
  },
  {
    label: 'Hearts',
    items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕', '💯', '✨'],
  },
  {
    label: 'Fun',
    items: ['🔥', '🎉', '🤣', '😮‍💨', '🤯', '💀', '🙈', '🚀', '🌟', '🍾', '☕', '🎧'],
  },
];

const STICKERS = [
  { id: 'love-burst', label: 'Love burst', emoji: '😍', accent: '#ff5c8a' },
  { id: 'laugh-big', label: 'Big laugh', emoji: '😂', accent: '#ffbf3d' },
  { id: 'approved', label: 'Approved', emoji: '👍', accent: '#34c759' },
  { id: 'fire', label: 'Fire', emoji: '🔥', accent: '#ff7a32' },
  { id: 'party', label: 'Party', emoji: '🥳', accent: '#8b5cf6' },
  { id: 'mind-blown', label: 'Mind blown', emoji: '🤯', accent: '#38bdf8' },
  { id: 'please', label: 'Please', emoji: '🙏', accent: '#f59e0b' },
  { id: 'sleepy', label: 'Sleepy', emoji: '😴', accent: '#64748b' },
  { id: 'heart', label: 'Heart', emoji: '❤️', accent: '#ef4444' },
  { id: 'sparkle', label: 'Sparkle', emoji: '✨', accent: '#a855f7' },
  { id: 'strong', label: 'Strong', emoji: '💪', accent: '#10b981' },
  { id: 'coffee', label: 'Coffee', emoji: '☕', accent: '#92400e' },
];

export default function EmojiStickerTray({ activeTab, onTabChange, onEmoji, onSticker }) {
  return (
    <div className="emoji-sticker-tray">
      <div className="emoji-tray-tabs">
        <button className={activeTab === 'emoji' ? 'active' : ''} onClick={() => onTabChange('emoji')}>
          <Laugh size={16} />
          Emoji
        </button>
        <button className={activeTab === 'sticker' ? 'active' : ''} onClick={() => onTabChange('sticker')}>
          <Sticker size={16} />
          Stickers
        </button>
      </div>

      {activeTab === 'emoji' ? (
        <div className="emoji-panel">
          {EMOJI_GROUPS.map((group) => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              <div className="emoji-grid">
                {group.items.map((emoji) => (
                  <button key={emoji} onClick={() => onEmoji(emoji)} title={emoji}>
                    {emoji}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="sticker-grid">
          {STICKERS.map((sticker) => (
            <button
              key={sticker.id}
              className="sticker-option"
              style={{ '--sticker-accent': sticker.accent }}
              onClick={() => onSticker(sticker)}
              title={sticker.label}
            >
              <span>{sticker.emoji}</span>
              <small>{sticker.label}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
