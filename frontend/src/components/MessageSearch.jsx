import { useState } from 'react';
import api from '../api/client';
import { X } from 'lucide-react';

export default function MessageSearch({ conversationId, loadedMessageIds, onJump, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    const { data } = await api.get(`/conversations/${conversationId}/messages/search`, {
      params: { q: query },
    });
    setResults(data.messages);
    setSearched(true);
  }

  function handleResultClick(message) {
    if (loadedMessageIds.has(message._id)) {
      onJump(message._id);
      onClose();
    }
  }

  return (
    <div className="bg-picker-overlay" onClick={onClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bg-picker-header">
          <span>Search messages</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSearch} className="search-panel-form">
          <input
            type="text"
            placeholder="Search in this conversation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button type="submit">Search</button>
        </form>

        {searched && results.length === 0 && <p className="muted-note">No messages found</p>}

        <ul className="search-panel-results">
          {results.map((m) => {
            const isLoaded = loadedMessageIds.has(m._id);
            return (
              <li
                key={m._id}
                className={isLoaded ? 'jumpable' : ''}
                onClick={() => handleResultClick(m)}
                title={isLoaded ? 'Jump to message' : 'Older message - not currently loaded'}
              >
                <span className="search-result-sender">{m.sender.username}</span>
                <span className="search-result-snippet">{m.text}</span>
                <span className="search-result-time">
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
