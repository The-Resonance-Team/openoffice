'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register, oauthConnectUrl } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, orgName, name || undefined);
      router.push('/app');
    } catch (err) {
      setError('Registration failed. Email may already be in use.');
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
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Create an account</h1>
        <p style={{ color: 'var(--faint)', marginBottom: 32 }}>Get started with openoffice Cloud</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="name" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              Name (optional)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              Password
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
            <label htmlFor="orgName" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              Organization name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
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
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div style={{ margin: '24px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 14 }}>
          or continue with
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <a
            href={oauthConnectUrl('google')}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              textAlign: 'center',
              textDecoration: 'none',
              color: 'var(--fg)',
              background: 'var(--bg)',
            }}
          >
            Google
          </a>
          <a
            href={oauthConnectUrl('github')}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              textAlign: 'center',
              textDecoration: 'none',
              color: 'var(--fg)',
              background: 'var(--bg)',
            }}
          >
            GitHub
          </a>
        </div>

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 14, color: 'var(--faint)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--link)', textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
