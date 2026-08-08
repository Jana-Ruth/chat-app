import { useRef, useState, useCallback } from 'react';

// Records audio from the mic and resolves a Blob when stopped.
// Picks whatever mime type the browser actually supports for MediaRecorder.
function pickMimeType() {
  const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg'];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  // Resolves with { blob, mimeType, duration } once the recorder actually stops
  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return resolve(null);

      recorder.onstop = () => {
        clearInterval(timerRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const duration = seconds;
        setRecording(false);
        resolve({ blob, mimeType, duration });
      };

      recorder.stop();
    });
  }, [seconds]);

  const cancel = useCallback(() => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setSeconds(0);
    chunksRef.current = [];
  }, []);

  return { recording, seconds, start, stop, cancel };
}
