import { mediaUrl } from '../utils/media';
import { Mic } from 'lucide-react';

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export default function MessageAttachment({ attachment }) {
  if (!attachment?.url) return null;
  const url = mediaUrl(attachment.url);

  if (attachment.type === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={attachment.fileName || 'image'} className="attachment-image" />
      </a>
    );
  }

  if (attachment.type === 'video') {
    return <video src={url} controls className="attachment-video" />;
  }

  if (attachment.type === 'audio') {
    return (
      <div className="voice-note">
        <span className="voice-note-icon"><Mic size={14} /></span>
        <audio src={url} controls />
        {attachment.duration ? (
          <span className="voice-note-duration">{formatDuration(attachment.duration)}</span>
        ) : null}
      </div>
    );
  }

  return null;
}
