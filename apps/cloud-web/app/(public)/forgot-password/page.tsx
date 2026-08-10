'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, useForgotPassword, type ForgotPasswordForm } from '@/lib';

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

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const forgotPasswordMutation = useForgotPassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit((data) => {
    forgotPasswordMutation.mutate(data, {
      onSuccess: () => setSent(true),
      onError: () =>
        setError('root', {
          type: 'manual',
          message: 'Failed to send reset email. Please try again.',
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
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Reset password</h1>
        <p style={{ color: 'var(--faint)', marginBottom: 32 }}>
          Enter your email and we&apos;ll send you a reset link
        </p>

        {sent ? (
          <div style={{ padding: '16px', background: 'var(--card)', borderRadius: 6 }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              If an account exists for <strong>{forgotPasswordMutation.variables?.email}</strong>,
              we&apos;ve sent a reset link.
            </p>
            <p style={{ fontSize: 14, color: 'var(--faint)' }}>
              Check your email and follow the instructions to reset your password.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
                Email
              </label>
              <input id="email" type="email" {...register('email')} style={inputStyle} />
              {errors.email && <div style={errorStyle}>{errors.email.message}</div>}
            </div>

            {errors.root && (
              <div style={{ color: '#ef4444', fontSize: 14, padding: '8px 0' }}>
                {errors.root.message}
              </div>
            )}

            <button
              type="submit"
              disabled={forgotPasswordMutation.isPending}
              style={{
                width: '100%',
                padding: '12px',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                background: 'var(--btn)',
                color: 'var(--btn-fg)',
                cursor: forgotPasswordMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: forgotPasswordMutation.isPending ? 0.6 : 1,
              }}
            >
              {forgotPasswordMutation.isPending ? 'Sending...' : 'Send reset link'}
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
