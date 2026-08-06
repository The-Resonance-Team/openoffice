// Mock chat/session for standalone UI use — no daemon required.
// TODO: swap back to lib/api.ts's createSession/postTurn/streamSession once
// the daemon is reachable in this environment; see lib/use-session.ts.

export const mockGreeting =
  "Hi — I've pulled together the Q3 board report. The executive summary, " +
  "revenue bridge, and board deck are all in the working folder on the " +
  "right. Let me know what you'd like to adjust.";

const replyPool = [
  "Updated the revenue bridge in the working xlsx — the Q4 scenario tab now reflects the new assumptions.",
  "Good catch. I've rewritten the variance commentary in the executive summary to call that out explicitly.",
  "Done — the board deck's risk & outlook slide now matches the numbers in the workbook.",
  "I checked the appendix tables against the finance close; two rows needed rounding fixes, now corrected.",
  "That's reflected in the draft now. Accept the file in the working folder once you've reviewed it.",
  "I can do that, but it'll shift the Q4 forecast — want me to model both scenarios side by side?",
];

let replyCursor = 0;

export function pickMockReply(userText: string): string {
  const lower = userText.toLowerCase();
  if (lower.includes("revenue") || lower.includes("bridge"))
    return replyPool[0];
  if (lower.includes("summary") || lower.includes("variance"))
    return replyPool[1];
  if (
    lower.includes("deck") ||
    lower.includes("slide") ||
    lower.includes("risk")
  )
    return replyPool[2];
  if (lower.includes("appendix") || lower.includes("table"))
    return replyPool[3];
  if (lower.includes("accept") || lower.includes("done")) return replyPool[4];
  const reply = replyPool[replyCursor % replyPool.length];
  replyCursor += 1;
  return reply;
}

export function mockSessionId(): string {
  return `mock-${Math.random().toString(36).slice(2, 10)}`;
}
