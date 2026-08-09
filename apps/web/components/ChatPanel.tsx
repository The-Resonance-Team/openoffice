'use client';

import { useUiStore } from '@/lib';
import type { ChatMessage } from '@/lib';
import { Composer } from './Composer';
import { Icon, IconFill } from '@/lib';

export function ChatPanel({
  messages,
  streaming,
  busy,
  error,
  send,
}: {
  messages: ChatMessage[];
  streaming: string;
  busy: boolean;
  error: string | null;
  send: (message: string) => void | Promise<void>;
}) {
  const viewerOpen = useUiStore((s) => s.viewerOpen);
  const rightRegion = useUiStore((s) => s.rightRegion);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const sidebarBtnColor = !viewerOpen && rightRegion === 'sidebar' ? 'text-ink' : 'text-muted';

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      <header className="relative flex flex-none items-center gap-[10px] px-4 pb-3 pt-2">
        <div className="flex-1" />
        <button className="flex max-w-full items-center gap-[7px] rounded-lg px-3 py-[7px] text-ink hover:bg-panel2">
          <span className="oo-el text-[14.5px] font-semibold">Q3 board report &amp; model</span>
          <span className="text-faint">
            <Icon name="chevronDown" size={16} />
          </span>
        </button>
        <div className="flex flex-1 justify-end">
          <button
            type="button"
            title="Toggle panel"
            onClick={toggleSidebar}
            className={`grid h-[34px] w-[34px] flex-none place-items-center rounded-lg hover:bg-panel2 ${sidebarBtnColor}`}
          >
            <Icon name="panelRight" size={18} />
          </button>
        </div>
      </header>

      <div className="oo-scroll flex-1 overflow-y-auto py-2">
        <div className="mx-auto flex max-w-[744px] flex-col gap-7 px-8">
          {messages.length === 0 && !streaming && (
            <div className="pt-16 text-center text-[14px] text-faint">
              Say something to start the session.
            </div>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-[18px] rounded-br-[6px] border border-line bg-panel px-[17px] py-[13px] text-[15px] leading-[1.6]">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-[14px]">
                <div
                  className="mt-[2px] grid h-7 w-7 flex-none place-items-center rounded-lg text-white"
                  style={{
                    background: 'linear-gradient(135deg,#ff7a5e,#c21f07)',
                  }}
                >
                  <IconFill name="sparkles" size={15} />
                </div>
                <div className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] leading-[1.72] text-ink">
                  {m.content}
                </div>
              </div>
            ),
          )}
          {streaming && (
            <div className="flex gap-[14px]">
              <div
                className="mt-[2px] grid h-7 w-7 flex-none place-items-center rounded-lg text-white"
                style={{
                  background: 'linear-gradient(135deg,#ff7a5e,#c21f07)',
                }}
              >
                <IconFill name="sparkles" size={15} />
              </div>
              <div className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] leading-[1.72] text-ink">
                {streaming}
              </div>
            </div>
          )}
          {busy && !streaming && (
            <div className="flex items-center gap-[11px] pt-[2px] text-[14px] text-muted">
              <span className="flex animate-spin text-accent2">
                <Icon name="loader" size={16} />
              </span>
              <span>Thinking…</span>
            </div>
          )}
          {error && <div className="text-[13px] text-accent2">{error}</div>}
        </div>
      </div>
      <Composer onSend={send} />
    </section>
  );
}
