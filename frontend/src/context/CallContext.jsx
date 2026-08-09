import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const RING_TIMEOUT_SECONDS = 60;

function userIdOf(user) {
  return user?.id || user?._id;
}

export function CallProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();

  // 'idle' | 'outgoing' | 'incoming' | 'active'
  const [callState, setCallState] = useState('idle');
  const [callInfo, setCallInfo] = useState(null); // { callId, conversationId, callType, otherUser, isCaller }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [duration, setDuration] = useState(0);
  const [ringingRemaining, setRingingRemaining] = useState(RING_TIMEOUT_SECONDS);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [error, setError] = useState('');

  const pcRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const remoteStreamRef = useRef(null);
  const timerRef = useRef(null);
  const ringingIntervalRef = useRef(null);
  const ringingTimeoutRef = useRef(null);
  const callInfoRef = useRef(null); // mirrors callInfo for use inside socket callbacks (avoids stale closures)

  useEffect(() => {
    callInfoRef.current = callInfo;
  }, [callInfo]);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(ringingIntervalRef.current);
    clearTimeout(ringingTimeoutRef.current);
    timerRef.current = null;
    ringingIntervalRef.current = null;
    ringingTimeoutRef.current = null;
    setDuration(0);
    setRingingRemaining(RING_TIMEOUT_SECONDS);

    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidatesRef.current = [];

    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    remoteStreamRef.current = null;
    setRemoteStream(null);
    setMuted(false);
    setVideoOff(false);
    setSpeakerOn(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]);

  const logCall = useCallback(
    (status, callDuration) => {
      const info = callInfoRef.current;
      if (!socket || !info) return;
      socket.emit('call:log', {
        conversationId: info.conversationId,
        callType: info.callType,
        status,
        duration: callDuration || 0,
      });
    },
    [socket]
  );

  const endCall = useCallback(
    (opts = {}) => {
      const info = callInfoRef.current;
      const { notifyRemote = true, logStatus } = opts;
      if (info && notifyRemote && socket) {
        socket.emit('call:end', { callId: info.callId, toUserId: userIdOf(info.otherUser) });
      }
      if (info?.isCaller && logStatus) {
        logCall(logStatus, duration);
      }
      cleanup();
      setCallState('idle');
      setCallInfo(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [socket, cleanup, duration, logCall]
  );

  function createPeerConnection(otherUserId) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const remoteMedia = new MediaStream();
    remoteStreamRef.current = remoteMedia;
    setRemoteStream(remoteMedia);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('call:ice-candidate', { toUserId: otherUserId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const baseStream = remoteStreamRef.current || new MediaStream();
      if (!baseStream.getTracks().some((track) => track.id === e.track.id)) {
        baseStream.addTrack(e.track);
      }
      const nextStream = new MediaStream(baseStream.getTracks());
      remoteStreamRef.current = nextStream;
      setRemoteStream(nextStream);
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        setError('Call connection lost. Check both users have camera/microphone permission and a stable network.');
        endCall({ notifyRemote: false, logStatus: 'completed' });
      }
    };

    pcRef.current = pc;
    return pc;
  }

  async function flushPendingCandidates() {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.error('Failed to add ICE candidate:', err);
      }
    }
  }

  function startTimer() {
    clearInterval(timerRef.current);
    clearInterval(ringingIntervalRef.current);
    clearTimeout(ringingTimeoutRef.current);
    ringingIntervalRef.current = null;
    ringingTimeoutRef.current = null;
    setDuration(0);
    setRingingRemaining(RING_TIMEOUT_SECONDS);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }

  const startCall = useCallback(
    async (conversationId, otherUser, callType) => {
      setError('');
      if (otherUser?.isOnline === false) {
        setError(`${otherUser.username || 'This user'} is offline`);
        return;
      }
      setCallState('outgoing');
      setCallInfo({ callId: null, conversationId, callType, otherUser, isCaller: true });

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });
        setLocalStream(stream);

        const otherUserId = userIdOf(otherUser);
        const pc = createPeerConnection(otherUserId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit(
          'call:invite',
          { toUserId: otherUserId, conversationId, callType, sdp: offer },
          (res) => {
            if (res?.error) {
              setError(res.error);
              cleanup();
              setCallState('idle');
              setCallInfo(null);
            } else {
              setCallInfo((prev) => (prev ? { ...prev, callId: res.callId } : prev));
            }
          }
        );
      } catch (err) {
        console.error('startCall error:', err);
        setError('Could not access camera/microphone');
        cleanup();
        setCallState('idle');
        setCallInfo(null);
      }
    },
    [socket, cleanup]
  );

  const acceptCall = useCallback(async () => {
    const info = callInfoRef.current;
    if (!info?.incomingSdp) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: info.callType === 'video',
      });
      setLocalStream(stream);

      const pc = createPeerConnection(userIdOf(info.otherUser));
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(info.incomingSdp));
      await flushPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call:accept', { callId: info.callId, toUserId: userIdOf(info.otherUser), sdp: answer });
      setCallState('active');
      startTimer();
    } catch (err) {
      console.error('acceptCall error:', err);
      setError('Could not access camera/microphone');
      socket.emit('call:decline', { callId: info.callId, toUserId: userIdOf(info.otherUser) });
      cleanup();
      setCallState('idle');
      setCallInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, cleanup]);

  const declineCall = useCallback(() => {
    const info = callInfoRef.current;
    if (info && socket) {
      socket.emit('call:decline', { callId: info.callId, toUserId: userIdOf(info.otherUser) });
    }
    cleanup();
    setCallState('idle');
    setCallInfo(null);
  }, [socket, cleanup]);

  const cancelCall = useCallback(() => {
    const info = callInfoRef.current;
    if (info && socket) {
      socket.emit('call:cancel', { callId: info.callId, toUserId: userIdOf(info.otherUser) });
    }
    logCall('missed', 0);
    cleanup();
    setCallState('idle');
    setCallInfo(null);
  }, [socket, cleanup, logCall]);

  useEffect(() => {
    if (callState !== 'outgoing' && callState !== 'incoming') return;

    setRingingRemaining(RING_TIMEOUT_SECONDS);
    clearInterval(ringingIntervalRef.current);
    clearTimeout(ringingTimeoutRef.current);

    ringingIntervalRef.current = setInterval(() => {
      setRingingRemaining((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    ringingTimeoutRef.current = setTimeout(() => {
      const info = callInfoRef.current;
      if (info && socket) {
        if (callState === 'outgoing') {
          socket.emit('call:cancel', { callId: info.callId, toUserId: userIdOf(info.otherUser) });
          logCall('missed', 0);
          setError('No answer');
        } else {
          socket.emit('call:decline', { callId: info.callId, toUserId: userIdOf(info.otherUser) });
        }
      }
      cleanup();
      setCallState('idle');
      setCallInfo(null);
    }, RING_TIMEOUT_SECONDS * 1000);

    return () => {
      clearInterval(ringingIntervalRef.current);
      clearTimeout(ringingTimeoutRef.current);
      ringingIntervalRef.current = null;
      ringingTimeoutRef.current = null;
    };
  }, [callState, socket, cleanup, logCall]);

  function toggleMute() {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted((m) => !m);
  }

  function toggleVideo() {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = videoOff));
    setVideoOff((v) => !v);
  }

  function toggleSpeaker() {
    setSpeakerOn((value) => !value);
  }

  // ---- global socket listeners for incoming call signaling ----
  useEffect(() => {
    if (!socket) return;

    function handleIncoming({ callId, conversationId, callType, sdp, fromUser }) {
      // already on a call — silently decline (busy)
      if (callInfoRef.current) {
        socket.emit('call:decline', { callId, toUserId: userIdOf(fromUser) });
        return;
      }
      setCallState('incoming');
      setCallInfo({
        callId,
        conversationId,
        callType,
        otherUser: fromUser,
        isCaller: false,
        incomingSdp: sdp,
      });
    }

    async function handleAccepted({ sdp }) {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingCandidates();
      setCallState('active');
      startTimer();
    }

    function handleDeclined() {
      setError('Call declined');
      logCall('declined', 0);
      cleanup();
      setCallState('idle');
      setCallInfo(null);
    }

    function handleCancelled() {
      cleanup();
      setCallState('idle');
      setCallInfo(null);
    }

    function handleEnded() {
      const info = callInfoRef.current;
      if (info?.isCaller) logCall('completed', duration);
      cleanup();
      setCallState('idle');
      setCallInfo(null);
    }

    async function handleIceCandidate({ candidate }) {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.error('Failed to add ICE candidate:', err);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    }

    socket.on('call:incoming', handleIncoming);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:declined', handleDeclined);
    socket.on('call:cancelled', handleCancelled);
    socket.on('call:ended', handleEnded);
    socket.on('call:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:declined', handleDeclined);
      socket.off('call:cancelled', handleCancelled);
      socket.off('call:ended', handleEnded);
      socket.off('call:ice-candidate', handleIceCandidate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, cleanup, duration, logCall]);

  // stop everything if the user logs out mid-call
  useEffect(() => {
    if (!user) {
      cleanup();
      setCallState('idle');
      setCallInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <CallContext.Provider
      value={{
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
        startCall,
        acceptCall,
        declineCall,
        cancelCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleSpeaker,
        clearError: () => setError(''),
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
