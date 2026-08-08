import { Phone, Video } from 'lucide-react';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallLogEntry({ call }) {
  let label;
  if (call.status === 'missed') label = `Missed ${call.callType} call`;
  else if (call.status === 'declined') label = `${call.callType === 'video' ? 'Video' : 'Voice'} call declined`;
  else label = `${call.callType === 'video' ? 'Video' : 'Voice'} call - ${formatDuration(call.duration || 0)}`;

  return (
    <div className={`call-log-entry ${call.status !== 'completed' ? 'missed' : ''}`}>
      {call.callType === 'video' ? <Video size={15} /> : <Phone size={15} />}
      <span>{label}</span>
    </div>
  );
}
