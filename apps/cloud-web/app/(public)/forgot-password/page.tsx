'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPassword } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      id="main"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '96px 28px 40px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Reset password</h1>
        <p style={{ color: 'var(--faint)', marginBottom: 32 }}>
          Enter your email and we'll send you a reset link
        </p>

        {sent ? (
          <div style={{ padding: '16px', background: 'var(--card)', borderRadius: 6 }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              If an account exists for <strong>{email}</strong>, we've sent a reset link.
            </p>
            <p style={{ fontSize: 14, color: 'var(--faint)' }}>
              Check your email and follow the instructions to reset your password.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 14,
                  background: 'var(--bg)',
                  color: 'var(--fg)',
                }}
              />
            </div>

            {error && (
              <div style={{ color: '#ef4444', fontSize: 14, padding: '8px 0' }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                background: 'var(--btn)',
                color: 'var(--btn-fg)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 14, color: 'var(--faint)' }}>
          <Link href="/login" style={{ color: 'var(--link)', textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
