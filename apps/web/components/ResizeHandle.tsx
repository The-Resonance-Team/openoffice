"use client";

export function ResizeHandle({
  side,
  width,
  min,
  max,
  onResize,
  onDragStart,
  onDragEnd,
}: {
  side: "left" | "right";
  width: number;
  min: number;
  max: number;
  onResize: (w: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    onDragStart?.();

    let frame = 0;
    function onMouseMove(ev: MouseEvent) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const delta =
          side === "left" ? ev.clientX - startX : startX - ev.clientX;
        onResize(Math.min(max, Math.max(min, startWidth + delta)));
      });
    }
    function onMouseUp() {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onDragEnd?.();
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className="relative z-30 w-[3px] flex-none cursor-col-resize select-none"
    >
      <div className="absolute inset-y-0 -left-[3px] w-[9px]" />
      <div
        className={`absolute left-0 w-[3px] rounded-full bg-transparent ${
          side === "right" ? "inset-y-1 rounded-r-[18px]" : "inset-y-2"
        }`}
      />
    </div>
  );
}
