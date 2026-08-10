import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      navigate('/login', { state: { resetSuccess: true } });
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
          <h1>Set a new password</h1>
          {!token && <p className="error">This reset link is missing its token — check the link from your email.</p>}
          {error && <p className="error">{error}</p>}

          <input
            type="password"
            placeholder="New password (min 6 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" disabled={submitting || !token}>
            {submitting ? 'Saving...' : 'Reset password'}
          </button>
          <p>
            <Link to="/login">← Back to log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

