'use client';

import {
  useUiStore,
  connectors,
  skills,
  tasks,
  workingRaw,
  CheckSm,
  GDriveIcon,
  Icon,
} from '@/lib';

export function Sidebar() {
  const progressOpen = useUiStore((s) => s.progressOpen);
  const toggleProgress = useUiStore((s) => s.toggleProgress);
  const discarded = useUiStore((s) => s.discarded);
  const openViewer = useUiStore((s) => s.openViewer);

  const done = tasks.filter((t) => t.s === 'done').length;
  const total = tasks.length;

  return (
    <div className="oo-scroll flex-1 overflow-y-auto overflow-x-hidden">
      <section className="px-[18px] pb-4 pt-[18px]">
        <button
          type="button"
          onClick={toggleProgress}
          className="flex w-full items-center gap-[9px] text-ink"
        >
          <span className="text-[16px] font-bold tracking-[-.01em]">Progress</span>
          <span
            className="flex text-faint transition-transform"
            style={{
              transform: progressOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            <Icon name="chevronRight" size={15} />
          </span>
          <div className="flex-1" />
          <span className="text-[13px] tabular-nums text-muted">
            {done} of {total}
          </span>
        </button>
        <div className="mt-[13px] h-[6px] overflow-hidden rounded-full bg-panel3">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </div>
        {progressOpen && (
          <div className="mt-[14px] flex flex-col gap-px">
            {tasks.map((t) => (
              <div key={t.text} className="flex items-start gap-[11px] py-[5px]">
                {t.s === 'done' ? (
                  <span className="mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-accent text-white">
                    <CheckSm />
                  </span>
                ) : t.s === 'active' ? (
                  <span className="mt-px flex h-[18px] w-[18px] flex-none animate-spin place-items-center text-accent2">
                    <Icon name="loader" size={16} />
                  </span>
                ) : (
                  <span className="mt-px h-[18px] w-[18px] flex-none rounded-full border-[1.5px] border-line2" />
                )}
                <span
                  className={
                    'text-[13.5px] leading-normal ' +
                    (t.s === 'done'
                      ? 'text-muted'
                      : t.s === 'todo'
                        ? 'text-faint'
                        : 'font-semibold text-ink')
                  }
                >
                  {t.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mx-[18px] h-px bg-line" />

      <section className="px-[18px] py-4">
        <div className="flex items-center gap-[9px]">
          <span className="text-[16px] font-bold tracking-[-.01em]">Working folder</span>
          <span className="flex text-faint">
            <Icon name="chevronDown" size={16} />
          </span>
          <div className="flex-1" />
          <button
            type="button"
            title="Open folder"
            className="grid h-[30px] w-[30px] place-items-center rounded-lg text-muted hover:bg-panel2 hover:text-ink"
          >
            <Icon name="folderOpen" size={17} />
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-px">
          {workingRaw.map((w) => {
            const disc = w.open && discarded[w.open];
            const badge = disc ? 'discarded' : w.badge;
            return (
              <button
                key={w.name}
                type="button"
                onClick={() => {
                  if (w.open === 'fb') openViewer('fb', w.name);
                  else if (w.open) openViewer(w.open);
                }}
                className="flex w-full items-center gap-[11px] rounded-lg px-[9px] py-[7px] text-left hover:bg-panel2"
              >
                <span className={'flex ' + (w.dim ? 'text-faint' : 'text-muted')}>
                  <Icon name={w.icon} size={16} />
                </span>
                <span className={'oo-el text-[13.5px] ' + (w.dim ? 'text-faint' : 'text-ink')}>
                  {w.name}
                </span>
                {badge && (
                  <span
                    className={
                      'flex-none rounded-md px-[6px] py-[2px] text-[10px] font-semibold tracking-[.02em] ' +
                      (badge === 'draft' ? 'bg-accent-soft text-accent2' : 'text-faint')
                    }
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mx-[18px] h-px bg-line" />

      <section className="px-[18px] pb-[22px] pt-4">
        <div className="flex items-center gap-[9px]">
          <span className="text-[16px] font-bold tracking-[-.01em]">Context</span>
          <span className="flex text-faint">
            <Icon name="chevronDown" size={16} />
          </span>
        </div>
        <div className="my-2 mt-[14px] text-[11.5px] font-semibold text-faint">Connectors</div>
        <div className="flex flex-col gap-px">
          {connectors.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-[11px] rounded-lg px-[9px] py-[7px] hover:bg-panel2"
            >
              <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-lg bg-panel2 text-muted">
                {'drive' in c && c.drive ? (
                  <GDriveIcon size={15} />
                ) : (
                  <Icon name={c.icon!} size={15} />
                )}
              </span>
              <span className="text-[13.5px]">{c.name}</span>
            </div>
          ))}
        </div>
        <div className="my-2 mt-4 text-[11.5px] font-semibold text-faint">Skills</div>
        <div className="flex flex-col gap-px">
          {skills.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-[11px] rounded-lg px-[9px] py-[7px] hover:bg-panel2"
            >
              <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-lg bg-panel2 text-muted">
                <Icon name={s.icon} size={15} />
              </span>
              <span className="font-mono text-[13.5px]">{s.name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
