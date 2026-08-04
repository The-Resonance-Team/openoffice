import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ModelMessage } from "ai";
import { complete } from "./compact";
import type { Session } from "./types";
import type { Config } from "../config";

// Mirrors the handoff skill's rules (reference artifacts by path, suggested
// skills section, redaction, markdown output).
export const HANDOFF_PROMPT = `You are writing a handoff document so a fresh session can continue this work.

Rules:
- Summarise the conversation: what was done, what is in flight, and what remains.
- Reference existing artifacts (files, specs, plans, ADRs, issues, commits, diffs) by path or URL instead of duplicating their content.
- Include a "Suggested skills" section listing skills the next session should invoke.
- Redact sensitive information (API keys, passwords, personally identifiable information).
- Output Markdown.`;

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
    ((messages, model, cfg, focusHint) => {
      const prompt = focusHint
        ? `${HANDOFF_PROMPT}\n\nThe next session will focus on: ${focusHint}`
        : HANDOFF_PROMPT;
      return complete(messages, model, cfg, prompt);
    });

  const summary = await summarize(
    session.messages,
    session.model,
    config,
    focus
  );
  const path = join(dir, `handoff-${session.id}-${Date.now()}.md`);
  await mkdir(dir, { recursive: true });
  await writeFile(path, redactHandoff(summary), "utf8");
  return { path };
}
