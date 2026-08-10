'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, oauthConnectUrl, useLogin, type LoginForm } from '@/lib';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 14,
  background: 'var(--bg)',
  color: 'var(--fg)',
};

const errorStyle: React.CSSProperties = { color: '#ef4444', fontSize: 13, marginTop: 6 };

export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((data) => {
    loginMutation.mutate(data, {
      onSuccess: () => router.push('/app'),
      onError: () => setError('root', { type: 'manual', message: 'Invalid email or password' }),
    });
  });

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
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Sign in</h1>
        <p style={{ color: 'var(--faint)', marginBottom: 32 }}>Welcome back to openoffice Cloud</p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              Email
            </label>
            <input id="email" type="email" {...register('email')} style={inputStyle} />
            {errors.email && <div style={errorStyle}>{errors.email.message}</div>}
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              Password
            </label>
            <input id="password" type="password" {...register('password')} style={inputStyle} />
            {errors.password && <div style={errorStyle}>{errors.password.message}</div>}
          </div>

          {errors.root && (
            <div style={{ color: '#ef4444', fontSize: 14, padding: '8px 0' }}>
              {errors.root.message}
            </div>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            style={{
              width: '100%',
              padding: '12px',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              background: 'var(--btn)',
              color: 'var(--btn-fg)',
              cursor: loginMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: loginMutation.isPending ? 0.6 : 1,
            }}
          >
            {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
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
          <Link href="/forgot-password" style={{ color: 'var(--link)', textDecoration: 'none' }}>
            Forgot password?
          </Link>
          <span style={{ margin: '0 8px' }}>·</span>
          <Link href="/register" style={{ color: 'var(--link)', textDecoration: 'none' }}>
            Create an account
          </Link>
        </div>
      </div>
    </main>
  );
}
