"use client";

import { useQuery } from "@tanstack/react-query";
import { navPrimary, pinned, recents } from "@/lib/mock";
import { Icon } from "@/lib/icons";
import { getUpdateStatus } from "@/lib/api";

const navBase =
  "flex items-center gap-3 rounded-[9px] px-[11px] py-2 text-left text-[14px] font-medium text-muted hover:bg-panel2 hover:text-ink w-full";

export function LeftRail({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { data: updateStatus } = useQuery({
    queryKey: ["update-status"],
    queryFn: getUpdateStatus,
    retry: false,
    refetchInterval: 60_000,
  });

  return (
    <aside className="flex w-[284px] flex-none flex-col overflow-hidden bg-bg">
      <div className="flex items-center gap-[9px] px-[18px] pb-[10px] pt-4">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="flex-1" />
        <button
          type="button"
          title="Toggle panel"
          onClick={onToggleSidebar}
          className="grid h-[30px] w-[30px] flex-none place-items-center rounded-lg text-muted hover:bg-panel2 hover:text-ink"
        >
          <Icon name="panelRight" size={18} />
        </button>
        <button
          type="button"
          className="grid h-[30px] w-[30px] flex-none place-items-center rounded-lg text-muted hover:bg-panel2 hover:text-ink"
        >
          <Icon name="search" size={17} />
        </button>
      </div>

      <div className="px-[14px] pb-3 pt-0.5">
        <div className="flex gap-[5px] rounded-xl border border-line bg-panel p-1">
          <button className="flex flex-1 items-center justify-center gap-[7px] rounded-[9px] bg-panel3 px-[10px] py-[7px] text-[13.5px] font-semibold text-ink shadow-sm">
            <Icon name="home" size={17} />
            <span>Home</span>
          </button>
          <button className="flex flex-1 items-center justify-center gap-[7px] rounded-[9px] px-[10px] py-[7px] text-[13.5px] font-semibold text-muted hover:text-ink">
            <Icon name="codeXml" size={17} />
            <span>Code</span>
          </button>
        </div>
      </div>

      <nav className="flex flex-col gap-px px-3 pb-1">
        {navPrimary.map((it) => (
          <button key={it.label} type="button" className={navBase}>
            <Icon name={it.icon} size={18} />
            <span>{it.label}</span>
          </button>
        ))}
      </nav>

      <div className="oo-scroll flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        <div className="px-[11px] pb-[6px] pt-[10px] text-[11.5px] font-semibold tracking-[.02em] text-faint">
          Pinned
        </div>
        {pinned.map((s) => (
          <button key={s.label} type="button" className={navBase}>
            <Icon name={s.icon} size={18} />
            <span className="oo-el">{s.label}</span>
          </button>
        ))}
        <div className="flex items-center justify-between px-[11px] pb-[6px] pt-4">
          <div className="text-[11.5px] font-semibold tracking-[.02em] text-faint">
            Recents
          </div>
          <span className="flex text-faint">
            <Icon name="sliders" size={15} />
          </span>
        </div>
        {recents.map((s) => (
          <button
            key={s.label}
            type="button"
            className={navBase + (s.active ? " font-semibold text-ink" : "")}
          >
            <Icon name={s.icon} size={18} />
            <span className="oo-el">{s.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="m-3 flex items-center gap-[11px] rounded-xl border border-line bg-panel p-[9px_11px] text-left hover:bg-panel2"
      >
        <span
          className="grid h-[30px] w-[30px] flex-none place-items-center rounded-lg text-[14px] font-extrabold text-white"
          style={{ background: "linear-gradient(135deg,#ff7a5e,#c21f07)" }}
        >
          M
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold leading-tight">
            Meridian Labs
          </span>
          <span className="block text-[11.5px] text-muted">
            Pro · Office plan
          </span>
        </span>
        <span className="flex text-faint">
          <Icon name="chevronDown" size={16} />
        </span>
        <span
          className={
            "flex" + (updateStatus?.available ? " text-accent2" : " text-faint")
          }
          title={
            updateStatus?.available
              ? `Update available: ${updateStatus.version ?? ""}`
              : "Up to date"
          }
        >
          <Icon name="download" size={15} />
        </span>
      </button>
    </aside>
  );
}
