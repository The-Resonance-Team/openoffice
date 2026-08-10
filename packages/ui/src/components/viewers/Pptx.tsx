import { useUiStore } from '../../lib/store';
import { slides } from '../../lib/mock';

function SlideInner({ raw }: { raw: (typeof slides)[number] }) {
  if (raw.k === 'title') {
    return (
      <div className="flex h-full flex-col justify-center px-[12%]">
        <div className="mb-4 text-[12px] font-bold uppercase tracking-[.16em] text-accent">
          Board Review
        </div>
        <div className="text-[42px] font-extrabold leading-[1.05] tracking-[-.02em] text-[#1b1b1b]">
          {raw.t}
        </div>
        <div className="mt-4 text-[18px] text-[#555]">{raw.s}</div>
      </div>
    );
  }
  if (raw.k === 'kpi') {
    return (
      <div className="flex h-full flex-col justify-center px-[9%]">
        <div className="mb-[26px] text-[26px] font-extrabold text-[#1b1b1b]">{raw.t}</div>
        <div className="flex gap-5">
          {raw.kpis.map((k) => (
            <div key={k[1]} className="flex-1 border-t-[3px] border-accent pt-3">
              <div className="text-[38px] font-extrabold leading-none text-[#1b1b1b]">{k[0]}</div>
              <div className="mt-2 text-[14px] font-semibold text-[#333]">{k[1]}</div>
              <div className="mt-[3px] text-[13px] text-accent">{k[2]}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (raw.k === 'chart') {
    const mx = Math.max(...raw.bars.map((b) => b[1]));
    return (
      <div className="flex h-full flex-col px-[9%] pb-[7%] pt-[8%]">
        <div className="mb-5 text-[26px] font-extrabold text-[#1b1b1b]">{raw.t}</div>
        <div className="flex flex-1 items-end gap-[22px] border-b-2 border-[#1b1b1b]">
          {raw.bars.map((b, i) => (
            <div key={b[0]} className="flex h-full flex-1 flex-col items-center justify-end">
              <div className="mb-[6px] text-[13px] font-bold text-[#1b1b1b]">{b[1]}</div>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.round((b[1] / mx) * 100)}%`,
                  background: i === raw.bars.length - 1 ? 'var(--n3)' : 'var(--accent)',
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-[22px]">
          {raw.bars.map((b) => (
            <div key={b[0]} className="flex-1 text-center text-[12.5px] text-[#555]">
              {b[0]}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (raw.k === 'agenda') {
    return (
      <div className="flex h-full flex-col justify-center px-[10%]">
        <div className="mb-5 text-[26px] font-extrabold text-[#1b1b1b]">{raw.t}</div>
        {raw.items.map((x, i) => (
          <div key={x} className="flex items-center gap-[14px] border-b border-[#e2e2e2] py-[9px]">
            <span className="w-[26px] text-[15px] font-extrabold text-accent">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-[17px] text-[#1b1b1b]">{x}</span>
          </div>
        ))}
      </div>
    );
  }
  if (raw.k === 'quote') {
    return (
      <div className="flex h-full flex-col justify-center px-[11%]">
        <div className="font-serif text-[30px] font-semibold leading-[1.28] text-[#1b1b1b]">
          {raw.t}
        </div>
        <div className="mt-5 text-[15px] text-[#666]">{raw.s}</div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col justify-center bg-accent px-[11%]">
      <div className="text-[44px] font-extrabold leading-none text-white">{raw.t}</div>
      <div className="mt-[14px] text-[18px] text-white/90">{raw.s}</div>
    </div>
  );
}

export function PptxBody() {
  const activeSlide = useUiStore((s) => s.activeSlide);
  const setSlide = useUiStore((s) => s.setSlide);
  const raw = slides[activeSlide] ?? slides[0];

  return (
    <div className="flex h-full min-h-full flex-col">
      <div className="grid flex-1 place-items-center p-[26px]">
        <div className="relative aspect-video w-full max-w-[700px] overflow-hidden rounded-lg bg-white font-sans shadow-2xl">
          <div className="absolute left-0 top-0 z-[1] h-full w-2 bg-accent" />
          <SlideInner raw={raw} />
        </div>
      </div>
      <div className="oo-scroll flex flex-none gap-[9px] overflow-x-auto p-[12px_16px]">
        {slides.map((sl, i) => {
          const label =
            sl.k === 'title' || sl.k === 'closing' || sl.k === 'quote'
              ? sl.t.length > 26
                ? sl.t.slice(0, 24) + '…'
                : sl.t
              : sl.t;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              className={
                'relative flex h-[63px] w-[112px] flex-none items-center justify-center overflow-hidden rounded-md border bg-white p-0 ' +
                (i === activeSlide ? 'border-2 border-accent' : 'border-line2')
              }
            >
              <span className="absolute left-[6px] top-[3px] text-[9px] font-bold text-[#999]">
                {i + 1}
              </span>
              <span className="absolute left-0 top-0 h-full w-1 bg-accent" />
              <span className="px-[6px] text-center text-[8.5px] font-bold leading-[1.15] text-[#333]">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
