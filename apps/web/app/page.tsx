"use client";

import { useState } from "react";
import { useUiStore } from "@/lib/store";
import { useSession } from "@/lib/use-session";
import { LeftRail } from "@/components/LeftRail";
import { ChatPanel } from "@/components/ChatPanel";
import { Sidebar } from "@/components/Sidebar";
import { Viewer } from "@/components/Viewer";
import { ProviderDialog } from "@/components/ProviderDialog";
import { LoginDialog } from "@/components/LoginDialog";
import { ResizeHandle } from "@/components/ResizeHandle";
import { Icon } from "@/lib/icons";

const RIGHT_MIN = 300;
const RIGHT_MAX = 900;

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [draggingRight, setDraggingRight] = useState(false);
  const viewerOpen = useUiStore((s) => s.viewerOpen);
  const viewerExpanded = useUiStore((s) => s.viewerExpanded);
  const rightRegion = useUiStore((s) => s.rightRegion);
  const leftRailOpen = useUiStore((s) => s.leftRailOpen);
  const toggleLeftRail = useUiStore((s) => s.toggleLeftRail);
  const leftRailWidth = useUiStore((s) => s.leftRailWidth);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const viewerWidth = useUiStore((s) => s.viewerWidth);
  const setViewerWidth = useUiStore((s) => s.setViewerWidth);
  const { sessionId } = useSession();

  const showViewer = viewerOpen;
  const showSidebar = !viewerOpen && rightRegion === "sidebar";
  const rightVisible = showViewer || showSidebar;
  const chatVisible = !(showViewer && viewerExpanded);
  const rightResizable = rightVisible && !(showViewer && viewerExpanded);
  const rightWidth = showViewer ? viewerWidth : sidebarWidth;
  const setRightWidth = showViewer ? setViewerWidth : setSidebarWidth;

  return (
    <div className="flex h-screen w-full overflow-hidden text-ink">
      <div
        className={`flex flex-none overflow-hidden transition-[width,opacity,padding] duration-300 ease-in-out`}
        style={
          leftRailOpen
            ? { width: leftRailWidth + 8, padding: "8px 0 8px 8px", opacity: 1 }
            : { width: 0, padding: 0, opacity: 0 }
        }
      >
        <LeftRail onToggleLeftRail={toggleLeftRail} width={leftRailWidth} />
      </div>
      <button
        type="button"
        title="Toggle panel"
        onClick={toggleLeftRail}
        className={`fixed left-2 top-3 z-40 grid h-[30px] w-[30px] flex-none place-items-center rounded-lg text-muted transition-opacity duration-300 ease-in-out hover:bg-panel2 hover:text-ink ${
          leftRailOpen ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <Icon name="panelLeft" size={18} />
      </button>
      <div className="flex min-w-0 flex-1 p-[8px_8px_8px_0]">
        <div
          className={`flex min-w-0 overflow-hidden ${
            draggingRight ? "" : "transition-all duration-300 ease-in-out"
          } ${chatVisible ? "flex-1 opacity-100" : "w-0 flex-none opacity-0"}`}
        >
          <ChatPanel />
        </div>
        {rightResizable && (
          <div className="group/right flex">
            <ResizeHandle
              side="right"
              width={rightWidth}
              min={RIGHT_MIN}
              max={RIGHT_MAX}
              onResize={setRightWidth}
              onDragStart={() => setDraggingRight(true)}
              onDragEnd={() => setDraggingRight(false)}
            />
            <div
              className={`relative flex flex-col overflow-hidden ${
                draggingRight
                  ? ""
                  : "transition-[width,opacity] duration-300 ease-in-out"
              } ${
                rightVisible
                  ? showViewer && viewerExpanded
                    ? "min-w-0 flex-1 opacity-100"
                    : "flex-none opacity-100"
                  : "w-0 flex-none opacity-0"
              }`}
              style={
                rightVisible && !(showViewer && viewerExpanded)
                  ? { width: rightWidth }
                  : undefined
              }
            >
              <div
                className="pointer-events-none absolute inset-0 z-10 rounded-[18px] opacity-0 transition-opacity duration-200 group-hover/right:opacity-100"
                style={{
                  background:
                    "linear-gradient(to right, var(--color-accent2) 0%, transparent 60%)",
                  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  maskComposite: "exclude",
                  padding: "1px",
                }}
              />
              <div className="flex flex-1 flex-col overflow-hidden rounded-[18px] border border-line2 bg-panel shadow-2xl">
                {showSidebar && <Sidebar />}
                {showViewer && <Viewer sessionId={sessionId} />}
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        title="Connect to daemon"
        onClick={() => setLoginOpen(true)}
        className="fixed bottom-4 right-4 z-40 grid h-9 w-9 place-items-center rounded-full border border-line2 bg-panel text-muted shadow-lg hover:bg-panel2 hover:text-ink"
      >
        <Icon name="sliders" size={16} />
      </button>

      <ProviderDialog />
      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}
    </div>
  );
}
