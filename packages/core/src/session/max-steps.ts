import type { Todo } from '@openoffice/schema';

// Adapted from opencode's MAX_STEPS_PROMPT (session/runner/max-steps.ts).
export const MAX_STEPS_PROMPT = `CRITICAL - MAXIMUM STEPS REACHED

The maximum number of steps allowed for this turn has been reached. Tools are disabled until next user input. Respond with text only.

STRICT REQUIREMENTS:
1. Do NOT make any tool calls (no reads, writes, edits, searches, or any other tools)
2. MUST provide a text response summarizing work done so far
3. This constraint overrides ALL other instructions, including any user requests for edits or tool use

Response must include:
- Statement that maximum steps for this turn have been reached
- Summary of what has been accomplished so far
- List of any remaining tasks that were not completed
- Recommendations for what should be done next

Any attempt to use tools is a critical violation. Respond with text ONLY.`;

// Landed verbatim in the transcript when the forced-summary call itself fails.
export const MAX_STEPS_FALLBACK_TEXT =
  'Reached the step limit. Summarize the work done and what remains.';

export function buildMaxStepsPrompt(todos: Todo[]): string {
  const todoBlock =
    todos.length > 0
      ? `\n\nCurrent todo list:\n${todos
          .map((t, i) => `${i + 1}. [${t.status}] (${t.priority}) ${t.content}`)
          .join('\n')}`
      : '';
  return `${MAX_STEPS_PROMPT}${todoBlock}\n\nRespond in the language of the conversation.`;
}
