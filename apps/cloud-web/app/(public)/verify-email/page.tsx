'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { verifyEmail } from '@/lib/api';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    token ? 'verifying' : 'error',
  );
  const [error, setError] = useState(token ? '' : 'Invalid verification link');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyEmail(token)
      .then(() => {
        if (!cancelled) setStatus('success');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
          setError('Failed to verify email. Link may be expired.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Verify email</h1>

        {status === 'verifying' && (
          <p style={{ color: 'var(--faint)' }}>Verifying your email address...</p>
        )}

        {status === 'success' && (
          <div style={{ padding: '16px', background: 'var(--card)', borderRadius: 6 }}>
            <p style={{ fontSize: 14, marginBottom: 12, color: '#10b981' }}>
              Email verified successfully!
            </p>
            <p style={{ fontSize: 14, color: 'var(--faint)' }}>
              You can now sign in to your account.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: '16px', background: 'var(--card)', borderRadius: 6 }}>
            <p style={{ fontSize: 14, marginBottom: 12, color: '#ef4444' }}>{error}</p>
            <p style={{ fontSize: 14, color: 'var(--faint)' }}>
              Please request a new verification email or contact support.
            </p>
          </div>
        )}

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 14, color: 'var(--faint)' }}>
          <Link href="/login" style={{ color: 'var(--link)', textDecoration: 'none' }}>
            Go to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
