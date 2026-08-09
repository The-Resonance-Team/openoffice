"use client";

import { Icon } from "@/lib/icons";
import type { IconName } from "@/lib/mock";
import type { ChatPart } from "@/lib/use-session";

const OFFICE_VERB_LABELS: Record<string, string> = {
  get: "Reading",
  query: "Querying",
  view: "Viewing",
  set: "Editing",
  add: "Adding to",
  remove: "Removing from",
  move: "Moving in",
  swap: "Swapping in",
  refresh: "Refreshing",
  validate: "Validating",
  batch: "Editing",
  dump: "Dumping",
  import: "Importing into",
  merge: "Merging",
  create: "Creating",
  raw: "Reading",
  "raw-set": "Editing",
  help: "Looking up help for",
  open: "Opening",
  close: "Closing",
  save: "Saving",
};

const OFFICE_ICON: Record<string, IconName> = {
  docx: "fileText",
  xlsx: "sheet",
  pptx: "presentation",
};

function asParams(params: unknown): Record<string, unknown> {
  if (params && typeof params === "object")
    return params as Record<string, unknown>;
  if (typeof params === "string") {
    try {
      const parsed = JSON.parse(params);
      if (parsed && typeof parsed === "object")
        return parsed as Record<string, unknown>;
    } catch {
      // not JSON — fall through to empty params
    }
  }
  return {};
}

function basename(path: string): string {
  return path.split("/").pop() || path;
}

function extOf(name: string): string {
  return name.slice(name.lastIndexOf(".") + 1).toLowerCase();
}

function officeInfo(params: unknown): { label: string; icon: IconName } {
  const p = asParams(params);
  const verb = typeof p.command === "string" ? p.command : undefined;
  const file = typeof p.file === "string" ? basename(p.file) : undefined;
  const verbLabel = (verb && OFFICE_VERB_LABELS[verb]) || "Working on";
  return {
    label: file ? `${verbLabel} ${file}` : `${verbLabel} document`,
    icon: (file && OFFICE_ICON[extOf(file)]) || "codeXml",
  };
}

function toolInfo(
  tool: string,
  params: unknown
): { label: string; icon: IconName } {
  const p = asParams(params);
  const file = typeof p.file === "string" ? basename(p.file) : undefined;
  switch (tool) {
    case "officecli":
      return officeInfo(params);
    case "read":
      return {
        label: file ? `Reading ${file}` : "Reading a file",
        icon: "search",
      };
    case "write":
      return {
        label: file ? `Writing ${file}` : "Writing a file",
        icon: "fileText",
      };
    case "convert":
      return {
        label: file ? `Converting ${file}` : "Converting a file",
        icon: "download",
      };
    case "glob":
      return {
        label:
          typeof p.pattern === "string"
            ? `Searching for ${p.pattern}`
            : "Searching files",
        icon: "search",
      };
    case "grep":
      return {
        label:
          typeof p.query === "string"
            ? `Searching for "${p.query}"`
            : "Searching file contents",
        icon: "search",
      };
    case "question":
      return { label: "Asking a question", icon: "msg" };
    default:
      return { label: tool, icon: "codeXml" };
  }
}

function errorMessage(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (typeof r.error === "string") return r.error;
  if (r.error && typeof r.error === "object") {
    const e = r.error as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
  }
  if (typeof r.message === "string") return r.message;
  return null;
}

export function ToolCallCard({
  part,
}: {
  part: Extract<ChatPart, { kind: "tool" }>;
}) {
  const { label, icon } = toolInfo(part.tool, part.params);
  const err = part.status === "error" ? errorMessage(part.result) : null;

  return (
    <div className="my-1 inline-flex max-w-full flex-col gap-1 rounded-[10px] border border-line2 bg-panel2 px-[11px] py-[7px] text-[13px]">
      <div className="flex items-center gap-[8px]">
        <span
          className={
            "flex flex-none " +
            (part.status === "error"
              ? "text-accent2"
              : part.status === "running"
                ? "text-accent2"
                : "text-muted")
          }
        >
          {part.status === "running" ? (
            <span className="flex animate-spin">
              <Icon name="loader" size={14} />
            </span>
          ) : part.status === "error" ? (
            <Icon name="x" size={14} />
          ) : (
            <Icon name="check" size={14} />
          )}
        </span>
        <span className="flex flex-none text-muted">
          <Icon name={icon} size={14} />
        </span>
        <span className="text-ink">{label}</span>
      </div>
      {err && <div className="pl-[22px] text-[12px] text-accent2">{err}</div>}
    </div>
  );
}
