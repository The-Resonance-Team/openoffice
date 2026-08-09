'use client';

import { useState } from 'react';
import { loadAuth, saveAuth } from '@/lib';
import { Icon } from '@/lib';

export function LoginDialog({ onClose }: { onClose: () => void }) {
  const existing = loadAuth();
  const [username, setUsername] = useState(existing?.username ?? '');
  const [password, setPassword] = useState(existing?.password ?? '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username && !password) {
      saveAuth(null);
    } else {
      saveAuth({ username, password });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-6" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-[380px] max-w-full rounded-[20px] border border-line2 bg-panel shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="flex-1">
            <div className="text-lg font-bold tracking-tight">Connect to daemon</div>
            <div className="mt-1 text-[13px] text-muted">
              Only needed if the daemon requires a password. Leave blank to run without credentials.
            </div>
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="grid h-[34px] w-[34px] flex-none place-items-center rounded-lg text-muted hover:bg-panel2"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-lg border border-line2 bg-panel2 px-3 py-2 text-[14px] text-ink outline-none"
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-line2 bg-panel2 px-3 py-2 text-[14px] text-ink outline-none"
              autoComplete="current-password"
            />
          </label>
          <div className="text-[11.5px] text-faint">
            Stored in sessionStorage only — cleared when this tab closes.
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="submit"
            className="rounded-[10px] bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent2"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
