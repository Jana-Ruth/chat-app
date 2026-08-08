import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { createPost } from '../api/posts';

export default function PostComposer({ onClose, onCreated }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [mediaType, setMediaType] = useState(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('contacts');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (visibility !== 'custom' || !query.trim()) {
        setResults([]);
        return;
      }
      const { data } = await api.get('/users/search', { params: { q: query } });
      setResults(data.users);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, visibility]);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setMediaType(f.type.startsWith('video') ? 'video' : 'image');
  }

  function toggleUser(u) {
    const id = u.id || u._id;
    setSelectedUsers((prev) =>
      prev.some((p) => (p.id || p._id) === id) ? prev.filter((p) => (p.id || p._id) !== id) : [...prev, u]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('Choose a photo or video first');
      return;
    }
    if (visibility === 'custom' && selectedUsers.length === 0) {
      setError('Pick at least one person to share with');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('media', file);
      formData.append('caption', caption);
      formData.append('visibility', visibility);
      if (visibility === 'custom') {
        formData.append('visibleTo', JSON.stringify(selectedUsers.map((u) => u.id || u._id)));
      }
      const post = await createPost(formData);
      onCreated(post);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-picker-overlay" onClick={onClose}>
      <div className="post-composer" onClick={(e) => e.stopPropagation()}>
        <div className="bg-picker-header">
          <span>New post</span>
          <button onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <p className="error">{error}</p>}

          {previewUrl ? (
            <div className="post-composer-preview">
              {mediaType === 'video' ? <video src={previewUrl} controls /> : <img src={previewUrl} alt="preview" />}
              <button type="button" className="link-btn" onClick={() => fileInputRef.current?.click()}>
                Change media
              </button>
            </div>
          ) : (
            <button type="button" className="post-composer-picker" onClick={() => fileInputRef.current?.click()}>
              📷 Choose a photo or video
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={handleFileChange} />

          <textarea
            placeholder="Write a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={1000}
            rows={3}
          />

          <label className="post-composer-label">Who can see this?</label>
          <div className="visibility-options">
            <button
              type="button"
              className={visibility === 'everyone' ? 'active' : ''}
              onClick={() => setVisibility('everyone')}
            >
              🌐 Everyone
            </button>
            <button
              type="button"
              className={visibility === 'contacts' ? 'active' : ''}
              onClick={() => setVisibility('contacts')}
            >
              👥 My contacts
            </button>
            <button
              type="button"
              className={visibility === 'custom' ? 'active' : ''}
              onClick={() => setVisibility('custom')}
            >
              🔒 Selected people
            </button>
          </div>

          {visibility === 'custom' && (
            <div className="post-composer-custom">
              {selectedUsers.length > 0 && (
                <div className="chip-row">
                  {selectedUsers.map((u) => (
                    <span key={u.id || u._id} className="chip">
                      {u.username}
                      <button type="button" onClick={() => toggleUser(u)}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              <input
                type="text"
                placeholder="Search people..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {results.length > 0 && (
                <ul className="search-results">
                  {results.map((u) => (
                    <li key={u.id || u._id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedUsers.some((s) => (s.id || s._id) === (u.id || u._id))}
                          onChange={() => toggleUser(u)}
                        />
                        {u.username}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button type="submit" className="primary-btn post-composer-submit" disabled={submitting}>
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </form>
      </div>
    </div>
  );
}
