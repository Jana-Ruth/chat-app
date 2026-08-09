import { useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import Avatar from './Avatar';
import { Check, Mic, MicOff, PhoneOff, Video, VideoOff, Volume1, Volume2, X } from 'lucide-react';

const RING_TIMEOUT_SECONDS = 60;

function useRingtone(active) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();

    function ringOnce() {
      [660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = ctx.currentTime + i * 0.22;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.05, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    }

    ringOnce();
    intervalRef.current = setInterval(ringOnce, 1800);

    return () => {
      clearInterval(intervalRef.current);
      ctx.close().catch(() => {});
    };
  }, [active]);
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallOverlay() {
  const {
    callState,
    callInfo,
    localStream,
    remoteStream,
    duration,
    ringingRemaining,
    muted,
    videoOff,
    speakerOn,
    error,
    acceptCall,
    declineCall,
    cancelCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    clearError,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useRingtone(callState === 'incoming' || callState === 'outgoing');

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;
    video.srcObject = localStream;
    if (localStream) video.play?.().catch(() => {});
  }, [localStream, callState, videoOff]);

  useEffect(() => {
    const video = remoteVideoRef.current;
    const audio = remoteAudioRef.current;

    if (video) {
      video.srcObject = remoteStream;
      if (remoteStream) video.play?.().catch(() => {});
    }

    if (audio) {
      audio.srcObject = remoteStream;
      audio.volume = speakerOn ? 1 : 0.45;
      if (remoteStream) audio.play?.().catch(() => {});
    }
  }, [remoteStream, callState, videoOff, speakerOn, callInfo?.callType]);

  if (error && callState === 'idle') {
    return (
      <div className="call-overlay call-error-toast" onClick={clearError}>
        <p>{error}</p>
      </div>
    );
  }

  if (callState === 'idle' || !callInfo) return null;

  const isVideo = callInfo.callType === 'video';
  const isRinging = callState === 'incoming' || callState === 'outgoing';
  const otherIsOnline = callInfo.otherUser?.isOnline !== false;
  const ringProgress = Math.max(0, Math.min(1, ringingRemaining / RING_TIMEOUT_SECONDS));
  const callStatusLabel =
    callState === 'outgoing'
      ? 'Calling...'
      : callState === 'incoming'
        ? `Incoming ${isVideo ? 'video' : 'voice'} call...`
        : formatDuration(duration);

  return (
    <div className="call-overlay">
      <div className="call-overlay-backdrop" />
      <div className="call-card">
        {isVideo && callState === 'active' && !videoOff ? (
          <>
            <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline muted controls={false} />
            <video ref={localVideoRef} className="call-local-video" autoPlay playsInline muted controls={false} />
            <div className="call-video-header">
              <span>{callInfo.otherUser.username}</span>
              <span className="call-video-duration">{formatDuration(duration)}</span>
            </div>
          </>
        ) : (
          <div className="call-avatar-stage">
            <div className={`call-avatar-ring ${callState === 'active' ? 'connected' : 'pulsing'}`}>
              <Avatar user={callInfo.otherUser} size={120} />
            </div>
            <h2>{callInfo.otherUser.username}</h2>
            <div className={`call-presence ${otherIsOnline ? 'online' : 'offline'}`}>
              <span />
              {otherIsOnline ? 'Online' : 'Offline'}
            </div>
            <p className="call-status-text">{callStatusLabel}</p>
            {isRinging && (
              <div className="call-ring-timer">
                <div className="call-ring-timeline">
                  <span style={{ transform: `scaleX(${ringProgress})` }} />
                </div>
                Ends in {formatDuration(ringingRemaining)}
              </div>
            )}

          </div>
        )}

        <audio ref={remoteAudioRef} autoPlay playsInline hidden />

        <div className="call-controls">
          {callState === 'incoming' && (
            <>
              <button className="call-btn decline" onClick={declineCall} title="Decline">
                <X size={22} />
              </button>
              <button className="call-btn accept" onClick={acceptCall} title="Accept">
                <Check size={22} />
              </button>
            </>
          )}

          {callState === 'outgoing' && (
            <button className="call-btn decline" onClick={cancelCall} title="Cancel">
              <PhoneOff size={22} />
            </button>
          )}

          {callState === 'active' && (
            <>
              <button className={`call-btn mute ${muted ? 'active' : ''}`} onClick={toggleMute} title="Mute">
                {muted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>
              <button className={`call-btn speaker-toggle ${speakerOn ? 'active' : ''}`} onClick={toggleSpeaker} title={speakerOn ? 'Speaker on' : 'Normal volume'}>
                {speakerOn ? <Volume2 size={22} /> : <Volume1 size={22} />}
              </button>
              {isVideo && (
                <button className={`call-btn video-toggle ${videoOff ? 'active' : ''}`} onClick={toggleVideo} title="Toggle video">
                  {videoOff ? <VideoOff size={22} /> : <Video size={22} />}
                </button>
              )}
              <button className="call-btn decline" onClick={() => endCall({ logStatus: 'completed' })} title="End call">
                <PhoneOff size={22} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
