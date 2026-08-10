'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createApiKey,
  createInvite,
  forgotPassword,
  getMe,
  listApiKeys,
  login,
  register,
  resendVerification,
  resetPassword,
  revokeApiKey,
} from './api';
import type {
  ForgotPasswordForm,
  InviteForm,
  LoginForm,
  RegisterForm,
  ResetPasswordForm,
} from './form-schemas';
import { queryKeys } from './query-keys';

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: getMe,
    retry: false,
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: queryKeys.apiKeys(),
    queryFn: listApiKeys,
    retry: false,
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (v: RegisterForm) => register(v.email, v.password, v.orgName, v.name || undefined),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (v: LoginForm) => login(v.email, v.password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (v: ForgotPasswordForm) => forgotPassword(v.email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (v: ResetPasswordForm & { token: string }) => resetPassword(v.token, v.password),
  });
}

export function useInvite() {
  return useMutation({
    mutationFn: (v: InviteForm) => createInvite(v.email, v.role),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) => resendVerification(email),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name }: { name: string }) => createApiKey(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });
    },
  });
}
