'use client';

import { useUiStore } from '../lib/store';
import { providers } from '../lib/mock';
import { Icon } from '../lib/icons';

export function ProviderDialog() {
  const open = useUiStore((s) => s.providerDialogOpen);
  const close = useUiStore((s) => s.closeProviderDialog);
  const providersConnected = useUiStore((s) => s.providersConnected);
  const toggleProvider = useUiStore((s) => s.toggleProvider);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-6" onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[82vh] w-[520px] max-w-full flex-col overflow-hidden rounded-[20px] border border-line2 bg-panel shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-line px-[22px] py-5">
          <div className="flex-1">
            <div className="text-[18px] font-bold tracking-[-.01em]">Providers</div>
            <div className="mt-[3px] text-[13px] text-muted">
              Connect a provider to use its models in OpenOffice.
            </div>
          </div>
          <button
            type="button"
            title="Close"
            onClick={close}
            className="grid h-[34px] w-[34px] flex-none place-items-center rounded-lg text-muted hover:bg-panel2"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="oo-scroll flex flex-1 flex-col gap-px overflow-y-auto p-[10px_12px_14px]">
          {providers.map((p) => {
            const on = !!providersConnected[p.id];
            return (
              <div
                key={p.id}
                className="flex items-center gap-[13px] rounded-2xl p-3 hover:bg-panel2"
              >
                <span
                  className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl text-[15px] font-extrabold text-white"
                  style={{ background: p.color }}
                >
                  {p.letter}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold">{p.name}</div>
                  <div className="mt-px text-[12.5px] text-muted">
                    {p.desc} · {p.models} models
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleProvider(p.id)}
                  className={
                    'inline-flex items-center gap-[6px] rounded-[9px] px-[13px] py-[6px] text-[12.5px] font-semibold ' +
                    (on
                      ? 'border border-line2 bg-transparent text-muted'
                      : 'border border-[rgba(255,106,77,.42)] bg-accent-soft text-accent2')
                  }
                >
                  {on && <Icon name="check" size={13} sw={2.8} />}
                  {on ? 'Connected' : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
