import { useEffect, useRef, useState } from 'react';
import type { Session } from '../api/daemon';
import { AskCard } from './AskCard';

interface Props {
  session: Session;
  streamText: string;
  busy: boolean;
  ask: { promptID: string; question: string } | null;
  onSend: (text: string) => void;
  onAskAnswer: (promptID: string, answer: string) => void;
  previewOf: (m: Session['messages'][number]) => string;
}

export function ChatWindow({
  session,
  streamText,
  busy,
  ask,
  onSend,
  onAskAnswer,
  previewOf,
}: Props) {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages.length, streamText, ask]);

  const submit = () => {
    if (busy || !input.trim()) return;
    onSend(input);
    setInput('');
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="border-b border-zinc-800 px-4 py-2 text-xs text-zinc-500">
        {session.cwd} · {session.model}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {session.messages.map((m, i) => {
          const text = previewOf(m);
          if (!text && !m.parts.some((p) => p.type === 'tool')) return null;
          return (
            <div
              key={i}
              className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.info.role === 'user'
                  ? 'ml-auto bg-emerald-900/60 text-emerald-50'
                  : 'bg-zinc-800 text-zinc-100'
              }`}
            >
              {text}
              {m.parts
                .filter((p) => p.type === 'tool')
                .map((p, j) => (
                  <div key={j} className="mt-1 text-xs text-zinc-400">
                    ⚙ {p.tool}
                  </div>
                ))}
            </div>
          );
        })}

        {streamText && (
          <div className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100">
            {streamText}
          </div>
        )}

        {ask && (
          <AskCard
            question={ask.question}
            onSubmit={(answer) => onAskAnswer(ask.promptID, answer)}
          />
        )}

        <div ref={endRef} />
      </div>

      <footer className="border-t border-zinc-800 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={busy || !!session.endedAt}
            placeholder={
              busy
                ? 'Agent is working…'
                : session.endedAt
                  ? 'Session ended'
                  : 'Message (e.g. accept /path/to/file.docx)'
            }
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-700 disabled:opacity-50"
          />
          <button
            onClick={submit}
            disabled={busy || !input.trim()}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </footer>
    </main>
  );
}
