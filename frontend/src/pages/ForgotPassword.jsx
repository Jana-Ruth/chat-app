import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero-content">
          <div className="auth-hero-mark" />
          <h1>Jana</h1>
          <p>Real-time conversations, beautifully simple.</p>
        </div>
      </div>
      <div className="auth-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h1>Forgot password?</h1>
          <p className="auth-subtitle">Enter your email and we'll send you a link to reset it.</p>
          {error && <p className="error">{error}</p>}
          {message && <p className="success-msg">{message}</p>}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send reset link'}
          </button>
          <p>
            <Link to="/login">← Back to log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

