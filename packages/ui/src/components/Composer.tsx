'use client';

import { useRef, useState } from 'react';
import { useUiStore } from '../lib/store';
import { models } from '../lib/mock';
import { Icon } from '../lib/icons';

export function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const modelMenuOpen = useUiStore((s) => s.modelMenuOpen);
  const toggleModelMenu = useUiStore((s) => s.toggleModelMenu);
  const closeModelMenu = useUiStore((s) => s.closeModelMenu);
  const activeModel = useUiStore((s) => s.activeModel);
  const pickModel = useUiStore((s) => s.pickModel);
  const openProviderDialog = useUiStore((s) => s.openProviderDialog);

  const activeM = models.find((m) => m.id === activeModel) ?? models[0];
  const hasText = value.trim().length > 0;

  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(200, el.scrollHeight) + 'px';
  }

  function submit() {
    if (!value.trim()) return;
    onSend(value);
    setValue('');
    requestAnimationFrame(autoGrow);
  }

  return (
    <div className="flex-none px-8 pb-[14px] pt-[6px]">
      <div className="relative z-40 mx-auto max-w-[744px]">
        {modelMenuOpen && (
          <>
            <div className="fixed inset-0 z-[1]" onClick={closeModelMenu} />
            <div className="absolute bottom-[78px] right-[6px] z-[2] w-[322px] overflow-hidden rounded-2xl border border-line2 bg-panel shadow-2xl">
              <div className="px-[15px] pb-[7px] pt-3 text-[11.5px] font-semibold text-faint">
                Model
              </div>
              <div className="flex flex-col gap-px px-[7px] pb-[6px]">
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pickModel(m.id)}
                    className="flex w-full items-start gap-[10px] rounded-[11px] px-[10px] py-[9px] text-left hover:bg-panel2"
                  >
                    <span
                      className="mt-px flex w-[18px] flex-none text-accent2"
                      style={{ opacity: m.id === activeModel ? 1 : 0 }}
                    >
                      <Icon name="check" size={16} sw={2.6} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-[7px]">
                        <span className="text-[14px] font-semibold text-ink">{m.name}</span>
                        {m.tier && (
                          <span className="rounded-[5px] bg-accent-soft px-[6px] py-px text-[10.5px] font-semibold text-accent2">
                            {m.tier}
                          </span>
                        )}
                      </span>
                      <span className="mt-[2px] block text-[12px] leading-snug text-muted">
                        {m.desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mx-0 my-[2px] h-px bg-line" />
              <button
                type="button"
                onClick={openProviderDialog}
                className="flex w-full items-center gap-[11px] px-[15px] py-3 text-left text-muted hover:bg-panel2 hover:text-ink"
              >
                <Icon name="shapes" size={17} />
                <span className="flex-1 text-[13.5px] font-medium">Manage providers</span>
                <span className="text-faint">
                  <Icon name="chevronRight" size={15} />
                </span>
              </button>
            </div>
          </>
        )}

        <div className="oo-composer overflow-hidden rounded-3xl border border-line2 bg-panel shadow-lg">
          <textarea
            ref={taRef}
            className="oo-ta oo-scroll w-full resize-none border-0 bg-transparent px-5 pb-[6px] pt-[17px] text-[15.5px] leading-[1.55] text-ink outline-none"
            placeholder="Reply to OpenOffice…"
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoGrow();
            }}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !composingRef.current &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                submit();
              }
            }}
            style={{ minHeight: 30, maxHeight: 200 }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-[11px] pt-[6px]">
            <div className="flex min-w-0 items-center gap-[5px]">
              <button
                type="button"
                title="Attach"
                className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-muted hover:bg-panel2 hover:text-ink"
              >
                <Icon name="plus" size={20} />
              </button>
              <button
                type="button"
                title="Add from working folder"
                className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-muted hover:bg-panel2 hover:text-ink"
              >
                <Icon name="folderPlus" size={19} />
              </button>
              <button
                type="button"
                className="flex flex-none items-center gap-[7px] rounded-[10px] px-[11px] py-2 text-[13.5px] font-semibold text-muted hover:bg-panel2 hover:text-ink"
              >
                <Icon name="modeAuto" size={17} />
                <span>Auto</span>
                <Icon name="chevronDown" size={15} />
              </button>
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-[5px]">
              <button
                type="button"
                onClick={toggleModelMenu}
                className="flex flex-none items-center gap-2 rounded-[10px] px-[11px] py-2 text-[13.5px] font-semibold text-muted hover:bg-panel2"
              >
                <span className="text-ink">{activeM.name}</span>
                {activeM.tier && <span>{activeM.tier}</span>}
                <Icon name="chevronDown" size={15} />
              </button>
              {hasText ? (
                <button
                  type="button"
                  title="Send"
                  onClick={submit}
                  className="grid h-[38px] w-[38px] flex-none place-items-center rounded-full bg-accent text-white hover:bg-accent2"
                >
                  <Icon name="arrowUp" size={19} />
                </button>
              ) : (
                <button
                  type="button"
                  title="Dictate"
                  className="grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-muted hover:bg-panel2 hover:text-ink"
                >
                  <Icon name="mic" size={19} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="mt-[10px] text-center text-[12px] text-faint">
          OpenOffice can make mistakes. Verify important figures before sharing.{' '}
          <a href="#" onClick={(e) => e.preventDefault()}>
            Give feedback
          </a>
        </div>
      </div>
    </div>
  );
}
