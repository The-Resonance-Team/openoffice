"use client";

import { useEffect, useRef, useState } from "react";
import {
  createSession,
  postTurn,
  streamSession,
  type StreamEvent,
} from "./api";

export interface ChatMessage {
  role: string;
  content: string;
}

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    createSession()
      .then((s) => {
        if (!cancelled) setSessionId(s.id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    abortRef.current = controller;

    function handle(ev: StreamEvent) {
      if (ev.type === "token") {
        setStreaming((s) => s + ev.token);
      } else if (ev.type === "message") {
        setMessages((m) => [
          ...m,
          { role: ev.role, content: String(ev.content) },
        ]);
      } else if (ev.type === "done") {
        setStreaming("");
      }
    }

    streamSession(sessionId, handle, controller.signal).catch((e) => {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

    return () => controller.abort();
  }, [sessionId]);

  async function send(message: string) {
    if (!sessionId || !message.trim()) return;
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    setError(null);
    try {
      const { text } = await postTurn(sessionId, message);
      setMessages((m) => [...m, { role: "assistant", content: text }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStreaming("");
    }
  }

  return { sessionId, messages, streaming, busy, error, send };
}
