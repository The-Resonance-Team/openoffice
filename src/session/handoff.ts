import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ModelMessage } from "ai";
import { complete } from "../llm/complete";
import type { Session } from "./types";
import type { Config } from "../config";

// The handoff document spec — the compaction summary follows it too: a
// handoff document so a fresh session (or the same session, compacted) can
// continue the work.
export const HANDOFF_PROMPT = `You are writing a handoff document so a fresh session can continue this work.

Rules:
- Summarise the conversation: what was done, what is in flight, and what remains.
- Reference existing artifacts (files, specs, plans, ADRs, issues, commits, diffs) by path or URL instead of duplicating their content.
- Include a "Suggested skills" section listing skills the next session should invoke.
- Redact sensitive information (API keys, passwords, personally identifiable information).
- Output Markdown.`;

export function withFocus(prompt: string, focus?: string): string {
  return focus
    ? `${prompt}\n\nThe next session will focus on: ${focus}`
    : prompt;
}

const REDACT_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /Bearer\s+[A-Za-z0-9._~+/-]{16,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /(password|passwd|secret|token|api[_-]?key)["']?\s*[:=]\s*["']?[^\s"',}]{6,}/gi,
];

export function redactHandoff(text: string): string {
  let out = text;
  for (const pattern of REDACT_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

export async function writeHandoffDoc(
  dir: string,
  sessionId: string,
  content: string
): Promise<string> {
  const path = join(dir, `handoff-${sessionId}-${Date.now()}.md`);
  await mkdir(dir, { recursive: true });
  await writeFile(path, content, "utf8");
  return path;
}

export type HandoffSummarizeFn = (
  messages: ModelMessage[],
  model: string,
  config: Config,
  focus?: string
) => Promise<string>;

export interface HandoffOptions {
  session: Session;
  config: Config;
  summarizeFn?: HandoffSummarizeFn;
  dir?: string;
  focus?: string;
}

export async function generateHandoff({
  session,
  config,
  summarizeFn,
  dir = tmpdir(),
  focus,
}: HandoffOptions): Promise<{ path: string }> {
  const summarize: HandoffSummarizeFn =
    summarizeFn ??
    ((messages, model, cfg, focusHint) =>
      complete({
        model,
        messages,
        config: cfg,
        prompt: withFocus(HANDOFF_PROMPT, focusHint),
      }));

  const summary = await summarize(
    session.messages,
    session.model,
    config,
    focus
  );
  const path = await writeHandoffDoc(dir, session.id, redactHandoff(summary));
  return { path };
}
