import { useCallback, useEffect, useRef, useState } from "react";
import {
  DaemonClient,
  textOf,
  type Session,
  type StreamEvent,
} from "./api/daemon";
import { SessionList } from "./components/SessionList";
import { ChatWindow } from "./components/ChatWindow";

interface Ask {
  promptID: string;
  question: string;
}

export default function App() {
  const [client, setClient] = useState<DaemonClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [streamText, setStreamText] = useState("");
  const [busy, setBusy] = useState(false);
  const [asks, setAsks] = useState<Ask[]>([]);
  const abortRef = useRef<(() => void) | null>(null);

  const subscribe = useCallback((c: DaemonClient, id: string) => {
    const stream: StreamEvent[] = [];
    abortRef.current?.();
    setStreamText("");
    setAsks([]);
    const push = (ev: StreamEvent) => {
      stream.push(ev);
      // session:message events carry persisted user turns; the streaming
      // assistant text accumulates tokens until done, then we refetch.
      setStreamText(
        stream
          .filter((e) => e.type === "token")
          .map((e) => (e as { token: string }).token)
          .join("")
      );
    };
    const off = c.stream(id, {
      token: (token) => push({ type: "token", token }),
      done: () => {
        void c
          .getSession(id)
          .then(setSession)
          .catch(() => undefined);
        setStreamText("");
        stream.length = 0;
      },
      ask: (promptID, question) =>
        setAsks((a) => [...a, { promptID, question }]),
      message: (role, content) => push({ type: "message", role, content }),
    });
    abortRef.current = off;
  }, []);

  useEffect(() => {
    let cancelled = false;
    DaemonClient.connect()
      .then(async (c) => {
        if (cancelled) return;
        setClient(c);
        const list = await c.listSessions();
        if (cancelled) return;
        setSessions(list);
        if (list.length > 0) selectSession(c, list[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      abortRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSession = useCallback(
    async (c: DaemonClient, id: string) => {
      setActiveId(id);
      const s = await c.getSession(id);
      setSession(s);
      subscribe(c, id);
    },
    [subscribe]
  );

  const handleSelect = (id: string) => {
    if (!client || id === activeId) return;
    void selectSession(client, id);
  };

  const handleNew = async () => {
    if (!client) return;
    const s = await client.createSession();
    setSessions((prev) => [s, ...prev]);
    await selectSession(client, s.id);
  };

  const handleSend = async (text: string) => {
    if (!client || !session || busy) return;
    const input = text.trim();
    if (!input) return;

    // Slash commands (CLI parity: accept/undo a draft by path).
    const cmd = input.match(/^\/(accept|undo)\s+(.+)$/);
    if (cmd) {
      const [, kind, filePath] = cmd;
      try {
        if (kind === "accept") await client.accept(session.id, filePath);
        else await client.undo(session.id, filePath);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      return;
    }

    setBusy(true);
    try {
      await client.turn(session.id, input);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAskAnswer = async (promptID: string, answer: string) => {
    if (!client || !session) return;
    await client.askAnswer(session.id, promptID, answer);
    setAsks((a) => a.filter((q) => q.promptID !== promptID));
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-200">
        <div className="max-w-md rounded-lg border border-red-800 bg-red-950/40 p-4">
          <p className="font-semibold text-red-300">Failed to start</p>
          <p className="mt-1 text-sm text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!client || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Starting daemon…
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200">
      <SessionList
        sessions={sessions}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={() => void handleNew()}
      />
      <ChatWindow
        session={session}
        streamText={streamText}
        busy={busy}
        ask={asks[0] ?? null}
        onSend={(t) => void handleSend(t)}
        onAskAnswer={(id, a) => void handleAskAnswer(id, a)}
        previewOf={textOf}
      />
    </div>
  );
}
