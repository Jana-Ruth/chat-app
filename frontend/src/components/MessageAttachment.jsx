import { useEffect, useRef, useState } from 'react';
import { mediaUrl } from '../utils/media';
import { Mic, Pause, Play, Radio } from 'lucide-react';

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function VoiceNotePlayer({ attachment, url }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(attachment.duration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    function handleTimeUpdate() {
      setCurrentTime(audio.currentTime || 0);
    }

    function handleLoadedMetadata() {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    }

    function handleEnded() {
      setPlaying(false);
      setCurrentTime(0);
    }

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  function handleSeek(event) {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const nextTime = ratio * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  const progress = duration ? Math.min((currentTime / duration) * 100, 100) : 0;
  const bars = [30, 58, 86, 48, 68, 38, 78, 52, 92, 44, 64, 36, 74, 50, 82, 42, 60, 34];

  return (
    <div className={`voice-note ${playing ? 'is-playing' : ''}`}>
      <button type="button" className="voice-note-play" onClick={togglePlayback} title={playing ? 'Pause voice note' : 'Play voice note'}>
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>

      <div className="voice-note-body">
        <div className="voice-note-heading">
          <span><Mic size={13} /> Voice note</span>
          <span className="voice-note-duration">{formatDuration(playing ? currentTime : duration)}</span>
        </div>

        <button type="button" className="voice-note-track" onClick={handleSeek} aria-label="Seek voice note">
          <span className="voice-note-progress" style={{ width: `${progress}%` }} />
          <span className="voice-note-wave" aria-hidden="true">
            {bars.map((height, index) => (
              <i key={index} style={{ '--bar-height': `${height}%` }} />
            ))}
          </span>
        </button>
      </div>

      <span className="voice-note-badge" title="Audio message">
        <Radio size={14} />
      </span>
      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  );
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
    return <VoiceNotePlayer attachment={attachment} url={url} />;
  }

  return null;
}
