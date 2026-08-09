'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createApiKey, getMe, listApiKeys, resendVerification, revokeApiKey } from './api';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    retry: false,
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: listApiKeys,
    retry: false,
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
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}
