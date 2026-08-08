import { useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import Avatar from './Avatar';

// Small self-contained ringtone loop, independent of the message sound packs.
function useRingtone(active) {
  const ctxRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    ctxRef.current = ctx;

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
    muted,
    videoOff,
    error,
    acceptCall,
    declineCall,
    cancelCall,
    endCall,
    toggleMute,
    toggleVideo,
    clearError,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useRingtone(callState === 'incoming' || callState === 'outgoing');

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  if (error && callState === 'idle') {
    return (
      <div className="call-overlay call-error-toast" onClick={clearError}>
        <p>{error}</p>
      </div>
    );
  }

  if (callState === 'idle' || !callInfo) return null;

  const isVideo = callInfo.callType === 'video';

  return (
    <div className="call-overlay">
      <div className="call-overlay-backdrop" />
      <div className="call-card">
        {isVideo && callState === 'active' && !videoOff ? (
          <>
            <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline />
            <video ref={localVideoRef} className="call-local-video" autoPlay playsInline muted />
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
            <p className="call-status-text">
              {callState === 'outgoing' && 'Calling…'}
              {callState === 'incoming' && `Incoming ${isVideo ? 'video' : 'voice'} call…`}
              {callState === 'active' && formatDuration(duration)}
            </p>
            <audio ref={remoteAudioRef} autoPlay hidden />
          </div>
        )}

        <div className="call-controls">
          {callState === 'incoming' && (
            <>
              <button className="call-btn decline" onClick={declineCall} title="Decline">✕</button>
              <button className="call-btn accept" onClick={acceptCall} title="Accept">✓</button>
            </>
          )}

          {callState === 'outgoing' && (
            <button className="call-btn decline" onClick={cancelCall} title="Cancel">✕</button>
          )}

          {callState === 'active' && (
            <>
              <button className={`call-btn mute ${muted ? 'active' : ''}`} onClick={toggleMute} title="Mute">
                {muted ? '🔇' : '🎙️'}
              </button>
              {isVideo && (
                <button className={`call-btn video-toggle ${videoOff ? 'active' : ''}`} onClick={toggleVideo} title="Toggle video">
                  {videoOff ? '📷' : '🎥'}
                </button>
              )}
              <button className="call-btn decline" onClick={() => endCall({ logStatus: 'completed' })} title="End call">✕</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
