// Client-side mirrors of cloud-api's class-validator DTOs (see apps/cloud-api
// src/*/dto) — zod keeps the browser form rules aligned with the server's
// ValidationPipe (ADR 0028). Drift is caught by integration, not unit tests.

import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().optional(),
  email: z.email(),
  password: z.string().min(8),
  orgName: z.string().min(1),
});
export type RegisterForm = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email(),
});
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(['ADMIN', 'TEAM_LEADER', 'MEMBER']),
});
export type InviteForm = z.infer<typeof inviteSchema>;

export const apiKeySchema = z.object({
  name: z.string(),
});
export type ApiKeyForm = z.infer<typeof apiKeySchema>;
