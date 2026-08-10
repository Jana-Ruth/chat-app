import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
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
          <ul className="auth-hero-points">
            <li>Voice & video calls, built in</li>
            <li>Photos, videos, and voice notes</li>
            <li>Share moments with a posts feed</li>
          </ul>
        </div>
      </div>
      <div className="auth-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h1>Welcome back</h1>
          {location.state?.resetSuccess && (
            <p className="success-msg">Password reset — log in with your new password.</p>
          )}
          {error && <p className="error">{error}</p>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Log in'}
          </button>
          <div className="auth-links-row">
            <Link to="/forgot-password">Forgot password?</Link>
            <Link to="/register">Create account</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

