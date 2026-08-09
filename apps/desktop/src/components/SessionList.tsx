import { differenceInMinutes, differenceInHours, format } from 'date-fns';
import type { Session } from '../api/daemon';

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function relativeTime(ts: number): string {
  const date = new Date(ts);
  const mins = differenceInMinutes(Date.now(), date);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = differenceInHours(Date.now(), date);
  if (hours < 24) return `${hours}h`;
  return format(date, 'MMM d, yyyy');
}

const preview = (s: Session): string => {
  const last = s.messages[s.messages.length - 1];
  if (!last) return 'New session';
  const text = last.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('')
    .trim();
  return text || '…';
};

export function SessionList({ sessions, activeId, onSelect, onNew }: Props) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-sm font-semibold text-zinc-300">OpenOffice Desktop</span>
        <button
          onClick={onNew}
          className="rounded px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-zinc-800"
        >
          + New
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto py-1">
        {sessions.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.id)}
              className={`block w-full px-3 py-2 text-left hover:bg-zinc-800 ${
                s.id === activeId ? 'bg-zinc-800' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-sm text-zinc-200">{s.title || s.cwd}</span>
                <span className="ml-2 shrink-0 text-[10px] text-zinc-500">
                  {relativeTime(s.updatedAt)}
                </span>
              </div>
              <p className="truncate text-xs text-zinc-500">
                {s.endedAt ? 'ended · ' : ''}
                {preview(s)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
