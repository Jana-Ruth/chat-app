import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/client';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import { useSocket } from '../context/SocketContext';

export default function ChatPage() {
  const { socket } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    api.get('/conversations').then(({ data }) => {
      setConversations(data.conversations);
      // arriving here via a profile page's "Message" button
      const openId = location.state?.openConversationId;
      if (openId) {
        const match = data.conversations.find((c) => c._id === openId);
        if (match) setActive(match);
        navigate(location.pathname, { replace: true, state: {} });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the conversation list preview + ordering fresh as new/edited/deleted messages arrive
  useEffect(() => {
    if (!socket) return;

    function handleNewMessage(message) {
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c._id === message.conversation ? { ...c, lastMessage: message } : c
        );
        const moved = updated.find((c) => c._id === message.conversation);
        const rest = updated.filter((c) => c._id !== message.conversation);
        return moved ? [moved, ...rest] : updated;
      });
    }

    function handleEdited(message) {
      setConversations((prev) =>
        prev.map((c) =>
          c.lastMessage?._id === message._id ? { ...c, lastMessage: message } : c
        )
      );
    }

    function handleDeleted({ messageId, conversationId }) {
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId && c.lastMessage?._id === messageId
            ? { ...c, lastMessage: { ...c.lastMessage, deleted: true, text: '' } }
            : c
        )
      );
    }

    function handlePresence({ userId, isOnline }) {
      function updateConversation(conv) {
        return {
          ...conv,
          participants: conv.participants.map((participant) => {
            const id = participant.id || participant._id;
            return id === userId ? { ...participant, isOnline } : participant;
          }),
        };
      }

      setConversations((prev) => prev.map(updateConversation));
      setActive((prev) => (prev ? updateConversation(prev) : prev));
    }

    socket.on('message:new', handleNewMessage);
    socket.on('message:edited', handleEdited);
    socket.on('message:deleted', handleDeleted);
    socket.on('presence:update', handlePresence);
    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:edited', handleEdited);
      socket.off('message:deleted', handleDeleted);
      socket.off('presence:update', handlePresence);
    };
  }, [socket]);

  function handleSelectConversation(conv) {
    setActive(conv);
  }

  function handleConversationCreated(conv) {
    setConversations((prev) => {
      const exists = prev.some((c) => c._id === conv._id);
      return exists ? prev : [conv, ...prev];
    });
    setActive(conv);
  }

  function handleConversationUpdated(conv) {
    setConversations((prev) => prev.map((c) => (c._id === conv._id ? conv : c)));
    setActive((prev) => (prev?._id === conv._id ? conv : prev));
  }

  function handleLeftGroup(conversationId) {
    setConversations((prev) => prev.filter((c) => c._id !== conversationId));
    setActive((prev) => (prev?._id === conversationId ? null : prev));
  }

  return (
    <div className={`chat-page ${active ? 'chat-selected' : 'chat-listing'}`}> 
      <Sidebar
        conversations={conversations}
        activeId={active?._id}
        onSelect={handleSelectConversation}
        onConversationCreated={handleConversationCreated}
      />
      <ChatWindow
        conversation={active}
        onConversationUpdated={handleConversationUpdated}
        onLeftGroup={handleLeftGroup}
        onBack={() => setActive(null)}
      />
    </div>
  );
}
