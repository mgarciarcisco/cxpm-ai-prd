import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './RegisterPage.css';

/**
 * Compute password strength (0–4) based on simple heuristics.
 */
function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score] || '' };
}

/**
 * Register page — allows new users to create an account.
 * Matches the design from mockups/auth-register-page.html.
 */
export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const passwordsMatch = confirmPassword === '' || password === confirmPassword;
  const confirmTouched = confirmPassword.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validations
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      const result = await register(name, email, password);
      if (result.status === 'pending_approval') {
        navigate('/pending-approval');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Render the 4 password strength bars.
   * Bars are colored based on the score:
   * - 1: red/danger
   * - 2: yellow/weak
   * - 3-4: teal/filled
   */
  const renderStrengthBars = () => {
    const bars = [];
    for (let i = 0; i < 4; i++) {
      let cls = 'register-strength-bar';
      if (i < strength.score) {
        if (strength.score === 1) {
          cls += ' danger';
        } else if (strength.score === 2) {
          cls += ' weak';
        } else {
          cls += ' filled';
        }
      }
      bars.push(<div key={i} className={cls} />);
    }
    return bars;
  };

  return (
    <div className="register-page">
      <div className="register-container">
        {/* Brand section */}
        <div className="register-branding">
          <div className="register-logo">
            <span>&#10038;</span>
          </div>
          <h1>CX AI Assistant for Product Managers</h1>
          <p>Prototype</p>
        </div>

        {/* Register card */}
        <div className="register-card">
          <h2>Create your account</h2>
          <p className="register-subtitle">Join your team on CX AI Assistant</p>

          {error && (
            <div className="register-form-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#DC2626" strokeWidth="1.5" />
                <path d="M8 5v3.5M8 10.5h.01" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="register-form-group">
              <label htmlFor="register-name">Full Name</label>
              <input
                type="text"
                id="register-name"
                placeholder="Jane Smith"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="register-form-group">
              <label htmlFor="register-email">Work Email</label>
              <input
                type="email"
                id="register-email"
                placeholder="jane@cisco.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className="register-hint register-hint--info">Only @cisco.com email addresses are allowed</span>
            </div>

            <div className="register-form-group">
              <label htmlFor="register-password">Password</label>
              <input
                type="password"
                id="register-password"
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              {password.length > 0 && (
                <>
                  <div className="register-password-strength">
                    {renderStrengthBars()}
                  </div>
                  <div className="register-strength-label">{strength.label}</div>
                </>
              )}
            </div>

            <div className={`register-form-group${confirmTouched && !passwordsMatch ? ' error' : ''}${confirmTouched && passwordsMatch ? ' success' : ''}`}>
              <label htmlFor="register-confirm">Confirm Password</label>
              <input
                type="password"
                id="register-confirm"
                placeholder="Re-enter your password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmTouched && !passwordsMatch && (
                <div className="register-hint">Passwords do not match</div>
              )}
            </div>

            <button
              type="submit"
              className="register-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="register-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
