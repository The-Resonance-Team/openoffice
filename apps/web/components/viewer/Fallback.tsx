import { Icon } from '@/lib/icons';
import type { IconName } from '@/lib/mock';

export function FallbackBody({ name, icon }: { name: string; icon: IconName }) {
  return (
    <div className="flex h-full min-h-[340px] flex-col items-center justify-center gap-4 p-10 text-center">
      <div className="grid h-[72px] w-[72px] place-items-center rounded-2xl border border-line bg-panel2 text-muted">
        <Icon name={icon} size={30} />
      </div>
      <div className="text-[17px] font-bold">{name}</div>
      <div className="max-w-[320px] text-[13.5px] leading-normal text-muted">
        No in-panel preview for this file type. It&apos;s an incidental file left in the working
        directory.
      </div>
      <button
        type="button"
        className="mt-1 inline-flex items-center gap-2 rounded-[11px] border border-line2 bg-panel2 px-4 py-[9px] text-[13.5px] font-semibold text-ink hover:bg-panel3"
      >
        <span className="flex text-muted">
          <Icon name="folder" size={15} />
        </span>
        Reveal in working folder
      </button>
    </div>
  );
}
