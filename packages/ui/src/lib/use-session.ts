"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createSession,
  getSession,
  postTurn,
  streamSession,
  type SessionDto,
  type StreamEvent,
} from "./api-client";

export type ChatPart =
  | { kind: "text"; text: string }
  | {
      kind: "tool";
      tool: string;
      params?: unknown;
      status: "running" | "done" | "error";
      result?: unknown;
    };

export interface ChatMessage {
  role: string;
  content: string;
  parts: ChatPart[];
}

interface RemotePart {
  type: string;
  text?: string;
  tool?: string;
  state?: {
    status: string;
    input?: unknown;
    output?: unknown;
    error?: { message: string };
  };
}
interface RemoteMessage {
  info: { role: string };
  parts: RemotePart[];
}

const ACTIVE_SESSION_KEY = "oo-active-session";

function completedResult(output: unknown): {
  status: "done" | "error";
  result: unknown;
} {
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
      if (parsed && typeof parsed === "object" && parsed.success === false) {
        return { status: "error", result: parsed };
      }
    } catch {
      // not JSON — a plain-text tool result, leave as done
    }
  }
  return { status: "done", result: output };
}

function toChatParts(parts: RemotePart[]): ChatPart[] {
  const out: ChatPart[] = [];
  for (const p of parts) {
    if (p.type === "text" && typeof p.text === "string" && p.text.length > 0) {
      out.push({ kind: "text", text: p.text });
    } else if (p.type === "tool" && p.tool) {
      if (p.state?.status === "error") {
        out.push({
          kind: "tool",
          tool: p.tool,
          params: p.state.input,
          status: "error",
          result: p.state.error,
        });
      } else if (p.state?.status === "completed") {
        const { status, result } = completedResult(p.state.output);
        out.push({
          kind: "tool",
          tool: p.tool,
          params: p.state.input,
          status,
          result,
        });
      } else {
        out.push({
          kind: "tool",
          tool: p.tool,
          params: p.state?.input,
          status: "running",
        });
      }
    }
  }
  return out;
}

function toChatMessages(session: SessionDto): ChatMessage[] {
  return (session.messages as RemoteMessage[])
    .map((m) => {
      const parts = toChatParts(m.parts);
      return {
        role: m.info.role,
        content: parts
          .filter(
            (p): p is Extract<ChatPart, { kind: "text" }> => p.kind === "text"
          )
          .map((p) => p.text)
          .join(""),
        parts,
      };
    })
    .filter((m) => m.parts.length > 0);
}

export function useSession() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingParts, setStreamingParts] = useState<ChatPart[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (id: string) => {
    const session = await getSession(id);
    setMessages(toChatMessages(session));
  }, []);

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
          // stored id is stale
        }
      }
      const session = await createSession();
      window.localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
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
      setStreamingParts([]);
      setError(null);
      await load(id);
      setSessionId(id);
    },
    [load]
  );

  const startSession = useCallback(async () => {
    abortRef.current?.abort();
    const session = await createSession();
    window.localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
    setMessages([]);
    setStreamingParts([]);
    setError(null);
    setSessionId(session.id);
    return session.id;
  }, []);

  async function send(message: string) {
    if (!sessionId || !message.trim() || busy) return;
    setMessages((m) => [
      ...m,
      {
        role: "user",
        content: message,
        parts: [{ kind: "text", text: message }],
      },
    ]);
    setBusy(true);
    setError(null);
    setStreamingParts([]);

    const controller = new AbortController();
    abortRef.current = controller;
    const parts: ChatPart[] = [];

    const streamDone = streamSession(
      sessionId,
      (ev: StreamEvent) => {
        if (ev.type === "token") {
          const last = parts[parts.length - 1];
          if (last?.kind === "text") {
            parts[parts.length - 1] = {
              kind: "text",
              text: last.text + ev.token,
            };
          } else {
            parts.push({ kind: "text", text: ev.token });
          }
          setStreamingParts([...parts]);
        } else if (ev.type === "toolStart") {
          parts.push({
            kind: "tool",
            tool: ev.tool,
            params: ev.params,
            status: "running",
          });
          setStreamingParts([...parts]);
        } else if (ev.type === "toolDone") {
          const idx = parts.findLastIndex(
            (p) =>
              p.kind === "tool" && p.tool === ev.tool && p.status === "running"
          );
          const result = ev.result as { success?: boolean } | undefined;
          const status = result?.success === false ? "error" : "done";
          const prev = idx >= 0 ? parts[idx] : undefined;
          if (prev?.kind === "tool") {
            parts[idx] = { ...prev, status, result: ev.result };
          } else {
            parts.push({
              kind: "tool",
              tool: ev.tool,
              status,
              result: ev.result,
            });
          }
          setStreamingParts([...parts]);
        }
      },
      controller.signal
    ).catch(() => undefined);

    try {
      const { text } = await postTurn(sessionId, message);
      const toolParts = parts.filter((p) => p.kind === "tool");
      const finalParts: ChatPart[] = text
        ? [...toolParts, { kind: "text", text }]
        : toolParts;
      setMessages((m) => [
        ...m,
        { role: "assistant", content: text, parts: finalParts },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "turn failed");
    } finally {
      controller.abort();
      await streamDone;
      setStreamingParts([]);
      setBusy(false);
    }
  }

  return {
    sessionId,
    messages,
    streamingParts,
    busy,
    error,
    send,
    switchSession,
    startSession,
  };
}
