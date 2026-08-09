'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export function useAIChat(options?: { api?: string }) {
  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: options?.api ?? '/api/chat',
    }),
  });

  return {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
  };
}
