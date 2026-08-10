'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { oauthConnectUrl, registerSchema, useRegister, type RegisterForm } from '@/lib';

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

export default function RegisterPage() {
  const router = useRouter();
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit((data) => {
    registerMutation.mutate(data, {
      onSuccess: () => router.push('/app'),
      onError: () =>
        setError('root', {
          type: 'manual',
          message: 'Registration failed. Email may already be in use.',
        }),
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
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Create an account</h1>
        <p style={{ color: 'var(--faint)', marginBottom: 32 }}>Get started with openoffice Cloud</p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="name" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              Name (optional)
            </label>
            <input id="name" type="text" {...register('name')} style={inputStyle} />
          </div>

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

          <div>
            <label htmlFor="orgName" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              Organization name
            </label>
            <input id="orgName" type="text" {...register('orgName')} style={inputStyle} />
            {errors.orgName && <div style={errorStyle}>{errors.orgName.message}</div>}
          </div>

          {errors.root && (
            <div style={{ color: '#ef4444', fontSize: 14, padding: '8px 0' }}>
              {errors.root.message}
            </div>
          )}

          <button
            type="submit"
            disabled={registerMutation.isPending}
            style={{
              width: '100%',
              padding: '12px',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              background: 'var(--btn)',
              color: 'var(--btn-fg)',
              cursor: registerMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: registerMutation.isPending ? 0.6 : 1,
            }}
          >
            {registerMutation.isPending ? 'Creating account...' : 'Create account'}
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
