import { Check, CheckCheck, Eye } from 'lucide-react';

// Computes and renders the WhatsApp-style tick state for a message I sent.
// single check = saved on the server, double gray = delivered to everyone else
// in the conversation, double violet = read by everyone else.
export default function MessageTicks({ message, otherParticipantIds }) {
  if (!otherParticipantIds || otherParticipantIds.length === 0) return null;

  const deliveredTo = (message.deliveredTo || []).map(String);
  const readBy = (message.readBy || []).map(String);

  const allDelivered = otherParticipantIds.every((id) => deliveredTo.includes(id));
  const allRead = otherParticipantIds.every((id) => readBy.includes(id));

  if (allRead) {
    return (
      <span className="ticks read" title="Read">
        <Eye size={13} />
      </span>
    );
  }
  if (allDelivered) {
    return (
      <span className="ticks delivered" title="Delivered">
        <CheckCheck size={14} />
      </span>
    );
  }
  return (
    <span className="ticks sent" title="Sent">
      <Check size={13} />
    </span>
  );
}
