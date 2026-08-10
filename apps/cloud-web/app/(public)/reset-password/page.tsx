'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid reset link');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      router.push('/login?reset=success');
    } catch {
      setError('Failed to reset password. Link may be expired.');
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
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Set new password</h1>
        <p style={{ color: 'var(--faint)', marginBottom: 32 }}>Enter your new password below</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
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

          <div>
            <label
              htmlFor="confirmPassword"
              style={{ display: 'block', fontSize: 14, marginBottom: 6 }}
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
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

          {error && <div style={{ color: '#ef4444', fontSize: 14, padding: '8px 0' }}>{error}</div>}

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
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 14, color: 'var(--faint)' }}>
          <Link href="/login" style={{ color: 'var(--link)', textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
