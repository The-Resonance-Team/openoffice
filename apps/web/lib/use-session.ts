'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createSession,
  getSession,
  postTurn,
  streamSession,
  type SessionDto,
  type StreamEvent,
} from './api';

export interface ChatMessage {
  role: string;
  content: string;
}

// A daemon message is WithParts: { info: { role }, parts: Part[] }. The web
// client owns no shared types with apps/cli (ADR 0024), so this shape is
// read structurally rather than imported.
interface RemotePart {
  type: string;
  text?: string;
}
interface RemoteMessage {
  info: { role: string };
  parts: RemotePart[];
}

const ACTIVE_SESSION_KEY = 'oo-active-session';

function toChatMessages(session: SessionDto): ChatMessage[] {
  return (session.messages as RemoteMessage[])
    .map((m) => ({
      role: m.info.role,
      content: m.parts
        .filter((p) => p.type === 'text' && typeof p.text === 'string')
        .map((p) => p.text)
        .join(''),
    }))
    .filter((m) => m.content.length > 0);
}

export function useSession() {
  const queryClient = useQueryClient();
  const createSessionMutation = useMutation({
    mutationFn: (cwd?: string) => createSession(cwd),
  });
  const postTurnMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => postTurn(id, message),
  });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // The useMutation result object is re-created on every status transition
  // (idle→pending→success), so referencing it directly in the init effect
  // deps would re-run the effect and create duplicate sessions. The ref is
  // refreshed in an effect that runs before the init effect below.
  const createSessionRef = useRef(createSessionMutation);
  useEffect(() => {
    createSessionRef.current = createSessionMutation;
  });

  const load = useCallback(
    async (id: string) => {
      const session = await queryClient.fetchQuery({
        queryKey: ['session', id],
        queryFn: () => getSession(id),
      });
      setMessages(toChatMessages(session));
    },
    [queryClient],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = window.localStorage.getItem(ACTIVE_SESSION_KEY);
      if (stored) {
        try {
          await load(stored);
          if (!cancelled) setSessionId(stored);
          return;
        } catch {
          // stored id is stale (deleted session, different daemon) — fall
          // through to creating a fresh one.
        }
      }
      const session = await createSessionRef.current.mutateAsync(undefined);
      window.localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      if (!cancelled) {
        setSessionId(session.id);
        setMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, queryClient]);

  const switchSession = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      window.localStorage.setItem(ACTIVE_SESSION_KEY, id);
      setStreaming('');
      setError(null);
      await load(id);
      setSessionId(id);
    },
    [load],
  );

  const startSession = useCallback(async () => {
    abortRef.current?.abort();
    const session = await createSessionRef.current.mutateAsync(undefined);
    window.localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
    setMessages([]);
    setStreaming('');
    setError(null);
    setSessionId(session.id);
    return session.id;
  }, []);

  async function send(message: string) {
    if (!sessionId || !message.trim() || busy) return;
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setBusy(true);
    setError(null);
    setStreaming('');

    const controller = new AbortController();
    abortRef.current = controller;
    let acc = '';

    // Tokens stream over SSE while the turn runs server-side; postTurn's own
    // response is the source of truth for the persisted message, the stream
    // is purely for the live typing effect.
    const streamDone = streamSession(
      sessionId,
      (ev: StreamEvent) => {
        if (ev.type === 'token') {
          acc += ev.token;
          setStreaming(acc);
        }
      },
      controller.signal,
    ).catch(() => undefined);

    try {
      const { text } = await postTurnMutation.mutateAsync({ id: sessionId, message });
      setMessages((m) => [...m, { role: 'assistant', content: text }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'turn failed');
    } finally {
      controller.abort();
      await streamDone;
      setStreaming('');
      setBusy(false);
    }
  }

  return {
    sessionId,
    messages,
    streaming,
    busy,
    error,
    send,
    switchSession,
    startSession,
  };
}
