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
import { Icon } from "@/lib/icons";

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const viewerOpen = useUiStore((s) => s.viewerOpen);
  const viewerExpanded = useUiStore((s) => s.viewerExpanded);
  const rightRegion = useUiStore((s) => s.rightRegion);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { sessionId } = useSession();

  const showViewer = viewerOpen;
  const showSidebar = !viewerOpen && rightRegion === "sidebar";
  const rightVisible = showViewer || showSidebar;
  const chatVisible = !(showViewer && viewerExpanded);
  const rightSizeClass =
    showViewer && viewerExpanded
      ? "min-w-0 flex-1"
      : showViewer
        ? "w-[648px] flex-none"
        : "w-[376px] flex-none";

  return (
    <div className="flex h-screen w-full overflow-hidden text-ink">
      <LeftRail onToggleSidebar={toggleSidebar} />
      <div className="flex min-w-0 flex-1 p-[8px_8px_8px_0]">
        {chatVisible && <ChatPanel />}
        {rightVisible && (
          <aside className={`flex flex-col overflow-hidden ${rightSizeClass}`}>
            <div className="flex flex-1 flex-col overflow-hidden rounded-[18px] border border-line2 bg-panel shadow-2xl">
              {showSidebar && <Sidebar />}
              {showViewer && <Viewer sessionId={sessionId} />}
            </div>
          </aside>
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
