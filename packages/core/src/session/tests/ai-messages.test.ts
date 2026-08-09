import { describe, expect, it } from 'bun:test';
import { filterCompacted, toModelMessages, truncateToolOutput } from '../ai-messages';
import type { WithParts } from '../parts';

const USER: WithParts = {
  info: { id: 'u1', role: 'user', parentID: 'p0', time: { created: 1 } },
  parts: [{ type: 'text', text: 'hello' }],
};

const ASSISTANT: WithParts = {
  info: {
    id: 'a1',
    role: 'assistant',
    parentID: 'u1',
    finish: 'done',
    time: { created: 2 },
  },
  parts: [
    { type: 'text', text: 'hi' },
    {
      type: 'tool',
      tool: 'read',
      callID: 'c1',
      state: {
        status: 'completed',
        input: { path: 'a.txt' },
        output: 'content',
      },
    },
  ],
};

const TOOL_ERROR: WithParts = {
  info: {
    id: 'a2',
    role: 'assistant',
    parentID: 'u1',
    finish: 'error',
    time: { created: 3 },
  },
  parts: [
    {
      type: 'tool',
      tool: 'read',
      callID: 'c2',
      state: { status: 'error', input: 'x', error: { message: 'boom' } },
    },
  ],
};

const COMPACTION_USER: WithParts = {
  info: { id: 'cu1', role: 'user', parentID: 'p0', time: { created: 4 } },
  parts: [{ type: 'compaction', auto: true, tail_start_id: 'u2' }],
};

const SUMMARY: WithParts = {
  info: {
    id: 'cs1',
    role: 'assistant',
    parentID: 'cu1',
    summary: true,
    finish: 'done',
    time: { created: 5 },
  },
  parts: [{ type: 'text', text: 'We built a thing.' }],
};

const TAIL: WithParts = {
  info: { id: 'u2', role: 'user', parentID: 'cu1', time: { created: 6 } },
  parts: [{ type: 'text', text: 'and then?' }],
};

describe('truncateToolOutput', () => {
  it('truncates long output with a marker', () => {
    const out = truncateToolOutput('x'.repeat(100), 10);
    expect(out.length).toBeLessThan(100);
    expect(out).toContain('omitted 90 chars');
  });

  it('passes short output through', () => {
    expect(truncateToolOutput('short', 100)).toBe('short');
  });
});

describe('toModelMessages', () => {
  it('turns user text into a user ModelMessage', () => {
    expect(toModelMessages([USER])).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]);
  });

  it("turns a compaction part into the 'What did we do so far?' prompt", () => {
    const msgs = toModelMessages([COMPACTION_USER]);
    expect(msgs).toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'What did we do so far?' }],
      },
    ]);
  });

  it('emits tool-call and tool-result pairs, truncating output', () => {
    const msgs = toModelMessages([ASSISTANT], { toolOutputMaxChars: 3 });
    expect(msgs).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'hi' },
          {
            type: 'tool-call',
            toolCallId: 'c1',
            toolName: 'read',
            input: { path: 'a.txt' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'c1',
            toolName: 'read',
            output: {
              type: 'text',
              value: expect.stringContaining('[Tool output truncated') as unknown as string,
            },
          },
        ],
      },
    ]);
  });

  it('marks failed tool calls as error-text results', () => {
    const msgs = toModelMessages([TOOL_ERROR]);
    expect(msgs[1] && msgs[1].role === 'tool' ? msgs[1].content[0] : null).toMatchObject({
      type: 'tool-result',
      toolCallId: 'c2',
      output: { type: 'error-text', value: 'boom' },
    });
  });
});

describe('filterCompacted', () => {
  it('moves the compaction span to the front, then the tail, then the rest', () => {
    const ordered = filterCompacted([COMPACTION_USER, SUMMARY, TAIL, USER]);
    expect(ordered.map((m) => m.info.id)).toEqual(['cu1', 'cs1', 'u2', 'u1']);
  });

  it('leaves un-compacted histories untouched', () => {
    const ordered = filterCompacted([USER, ASSISTANT]);
    expect(ordered.map((m) => m.info.id)).toEqual(['u1', 'a1']);
  });
});
