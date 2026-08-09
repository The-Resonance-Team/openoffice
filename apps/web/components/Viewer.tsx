'use client';

import { useMutation } from '@tanstack/react-query';
import { useUiStore } from '@/lib/store';
import { files, pageCounts, sheetNames, sheetOrder, slides, turnOrder } from '@/lib/mock';
import { CheckSm, GDriveIcon, Icon } from '@/lib/icons';
import { DocxBody } from './viewer/Docx';
import { XlsxBody } from './viewer/Xlsx';
import { PptxBody } from './viewer/Pptx';
import { PdfBody } from './viewer/Pdf';
import { FallbackBody } from './viewer/Fallback';

// TODO: session is mocked (lib/use-session.ts) so there's no real daemon
// session to accept/undo against yet — simulate the round trip locally. Takes
// the file path only to match the shape callers expect once wired for real.
function mockAcceptOrUndo(): Promise<{ ok: boolean }> {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 300));
}

const hoverBtn =
  'grid h-[34px] w-[34px] flex-none place-items-center rounded-lg text-muted hover:bg-panel2 hover:text-ink';

export function Viewer({ sessionId }: { sessionId: string | null }) {
  const activeId = useUiStore((s) => s.activeId);
  const fbName = useUiStore((s) => s.fbName);
  const viewerExpanded = useUiStore((s) => s.viewerExpanded);
  const toggleExpand = useUiStore((s) => s.toggleExpand);
  const closeViewer = useUiStore((s) => s.closeViewer);
  const switchFile = useUiStore((s) => s.switchFile);
  const accepted = useUiStore((s) => s.accepted);
  const discarded = useUiStore((s) => s.discarded);
  const acceptFileLocal = useUiStore((s) => s.acceptFile);
  const undoFileLocal = useUiStore((s) => s.undoFile);
  const activeSheet = useUiStore((s) => s.activeSheet);
  const setSheet = useUiStore((s) => s.setSheet);
  const activeSlide = useUiStore((s) => s.activeSlide);
  const docPage = useUiStore((s) => s.docPage);
  const pageStep = useUiStore((s) => s.pageStep);

  const acceptMutation = useMutation({
    mutationFn: (filePath: string) => {
      void filePath;
      if (!sessionId) throw new Error('no session');
      return mockAcceptOrUndo();
    },
    onSuccess: () => acceptFileLocal(),
  });
  const undoMutation = useMutation({
    mutationFn: (filePath: string) => {
      void filePath;
      if (!sessionId) throw new Error('no session');
      return mockAcceptOrUndo();
    },
    onSuccess: () => undoFileLocal(),
  });

  const isFb = activeId === 'fb';
  const f = !isFb ? files[activeId] : undefined;
  const af = isFb
    ? {
        name: fbName,
        ext: 'FILE',
        icon: 'file' as const,
        local: true,
        connector: '',
      }
    : {
        name: f!.name,
        ext: f!.ext,
        icon: f!.icon,
        local: f!.local,
        connector: f!.connector ?? '',
      };

  const isDocx = activeId === 'docx';
  const isXlsx = activeId === 'xlsx';
  const isPptx = activeId === 'pptx';
  const isPdf = activeId === 'pdf';
  const isDraft = !isFb && f?.draft && !accepted[activeId] && !discarded[activeId];
  const isSaved = !isFb && f?.draft && accepted[activeId];
  const isReadonly = !isFb && !!f?.connector;
  const pageCount = pageCounts[activeId] || 1;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-none items-center gap-[10px] p-[12px_12px_12px_16px]">
        <span className="flex flex-none text-muted">
          <Icon name={af.icon} size={18} />
        </span>
        <div className="oo-el flex-1 text-[14.5px] font-semibold">
          {af.name}
          <span className="font-normal text-faint"> · {af.ext}</span>
        </div>
        {af.local && (
          <button className="inline-flex flex-none items-center gap-[7px] rounded-[10px] border border-line2 bg-panel2 px-3 py-[7px] text-[12.5px] font-semibold text-ink hover:bg-panel3">
            <span className="flex text-muted">
              <Icon name="folder" size={15} />
            </span>
            Show in Folder
          </button>
        )}
        <button
          type="button"
          title={viewerExpanded ? 'Collapse' : 'Expand'}
          onClick={toggleExpand}
          className={hoverBtn}
        >
          <Icon name={viewerExpanded ? 'minimize' : 'maximize'} size={18} />
        </button>
        <button type="button" title="Close" onClick={closeViewer} className={hoverBtn}>
          <Icon name="x" size={18} />
        </button>
      </div>

      {!isFb && (
        <div className="oo-scroll flex flex-none gap-[5px] overflow-x-auto p-[0_12px_10px]">
          {turnOrder.map((tid) => {
            const tf = files[tid];
            return (
              <button
                key={tid}
                type="button"
                onClick={() => switchFile(tid)}
                className={
                  'flex items-center gap-[7px] whitespace-nowrap rounded-lg px-[13px] py-[7px] text-[13px] font-semibold ' +
                  (activeId === tid ? 'bg-panel2 text-ink' : 'text-muted')
                }
              >
                <Icon name={tf.icon} size={15} />
                <span>{tf.tab}</span>
              </button>
            );
          })}
        </div>
      )}

      {isDraft && (
        <div className="flex flex-none items-center gap-3 border-y border-line bg-accent-soft p-[11px_16px]">
          <span className="flex-none rounded-[6px] border border-[rgba(255,106,77,.4)] px-2 py-[2px] text-[10.5px] font-semibold tracking-[.02em] text-accent2">
            Draft
          </span>
          <span className="text-[13px] text-ink/85">
            Working copy — the file isn&apos;t changed until you Accept.
          </span>
          <div className="flex-1" />
          <button
            type="button"
            disabled={undoMutation.isPending}
            onClick={() => undoMutation.mutate(f!.name)}
            className="inline-flex items-center rounded-[10px] border border-line2 px-[15px] py-[7px] text-[13px] font-semibold text-ink hover:bg-panel2 disabled:opacity-50"
          >
            Undo
          </button>
          <button
            type="button"
            disabled={acceptMutation.isPending}
            onClick={() => acceptMutation.mutate(f!.name)}
            className="inline-flex items-center gap-[6px] rounded-[10px] bg-accent px-[17px] py-[7px] text-[13px] font-semibold text-white hover:bg-accent2 disabled:opacity-50"
          >
            Accept
            <CheckSm />
          </button>
        </div>
      )}
      {isSaved && (
        <div className="flex flex-none items-center gap-[10px] border-y border-line bg-white/[.03] p-[11px_16px]">
          <span className="flex text-accent2">
            <CheckSm />
          </span>
          <span className="text-[13px] text-muted">Accepted — saved to the working folder.</span>
        </div>
      )}
      {isReadonly && (
        <div className="flex flex-none items-center gap-[10px] border-y border-line bg-white/[.03] p-[11px_16px]">
          <GDriveIcon size={15} />
          <span className="text-[13px] text-muted">Read-only reference from Google Drive.</span>
        </div>
      )}

      <div
        className={
          'oo-scroll oo-lt flex-1 overflow-auto border-t border-line ' +
          (isXlsx ? 'bg-white' : 'bg-bg2')
        }
      >
        {isDocx ? (
          <DocxBody />
        ) : isXlsx ? (
          <XlsxBody />
        ) : isPptx ? (
          <PptxBody />
        ) : isPdf ? (
          <PdfBody />
        ) : (
          <FallbackBody name={af.name} icon={af.icon} />
        )}
      </div>

      {(isDocx || isPdf) && (
        <div className="flex flex-none items-center justify-center gap-[14px] border-t border-line p-[9px]">
          <button
            type="button"
            onClick={() => pageStep(-1, pageCount)}
            className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-panel2"
            style={{ transform: 'rotate(90deg)' }}
          >
            <Icon name="chevronDown" size={15} />
          </button>
          <span className="min-w-[78px] text-center text-[12.5px] tabular-nums text-muted">
            Page {docPage} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => pageStep(1, pageCount)}
            className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-panel2"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <Icon name="chevronDown" size={15} />
          </button>
        </div>
      )}
      {isXlsx && (
        <div className="oo-scroll flex flex-none items-stretch gap-[5px] overflow-x-auto border-t border-line p-[7px_10px]">
          {sheetOrder.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSheet(k)}
              className={
                'whitespace-nowrap rounded-lg px-[15px] py-[7px] text-[12.5px] ' +
                (k === activeSheet ? 'bg-panel2 font-bold text-ink' : 'text-muted')
              }
            >
              {sheetNames[k]}
            </button>
          ))}
        </div>
      )}
      {isPptx && (
        <div className="flex flex-none items-center justify-center border-t border-line p-[9px]">
          <span className="text-[12.5px] tabular-nums text-muted">
            Slide {activeSlide + 1} / {slides.length}
          </span>
        </div>
      )}
    </div>
  );
}
