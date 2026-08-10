'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, useResetPassword, type ResetPasswordForm } from '@/lib';

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

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const resetPasswordMutation = useResetPassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = handleSubmit((data) => {
    if (!token) {
      setError('root', { type: 'manual', message: 'Invalid reset link' });
      return;
    }
    resetPasswordMutation.mutate(
      { ...data, token },
      {
        onSuccess: () => router.push('/login?reset=success'),
        onError: () =>
          setError('root', {
            type: 'manual',
            message: 'Failed to reset password. Link may be expired.',
          }),
      },
    );
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
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Set new password</h1>
        <p style={{ color: 'var(--faint)', marginBottom: 32 }}>Enter your new password below</p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
              New password
            </label>
            <input id="password" type="password" {...register('password')} style={inputStyle} />
            {errors.password && <div style={errorStyle}>{errors.password.message}</div>}
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
              {...register('confirmPassword')}
              style={inputStyle}
            />
            {errors.confirmPassword && (
              <div style={errorStyle}>{errors.confirmPassword.message}</div>
            )}
          </div>

          {errors.root && (
            <div style={{ color: '#ef4444', fontSize: 14, padding: '8px 0' }}>
              {errors.root.message}
            </div>
          )}

          <button
            type="submit"
            disabled={resetPasswordMutation.isPending}
            style={{
              width: '100%',
              padding: '12px',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              background: 'var(--btn)',
              color: 'var(--btn-fg)',
              cursor: resetPasswordMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: resetPasswordMutation.isPending ? 0.6 : 1,
            }}
          >
            {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset password'}
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
