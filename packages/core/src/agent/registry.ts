import type { Agent } from './types';
import { evaluate, type Ruleset } from './permission';
import type { ToolDefinition } from '../tool/types';

const OFFICE_SYSTEM = `You are an office document assistant. You help users create, read, and edit Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) documents using the officecli tool.

You have access to document manipulation tools. Use the officecli tool for all document operations. Use read/write for plain text files. Use glob to find files. Use grep to search file contents.

Always use --json with officecli for structured output. When unsure about commands or properties, run officecli help first.`;

const DEVELOPER_SYSTEM = `You are a development assistant with full coding capabilities. You can read, write, and edit any file, run shell commands, and use all available tools.`;

const COMPACTION_SYSTEM = `You are the session compactor. The user messages are a session transcript. Your job is to produce a summary of the conversation in the current session, so a future session can continue the work.

You must:
- Summarize in the language of the conversation (English unless the conversation is in Vietnamese, in which case respond in Vietnamese).
- Keep a chronological (step by step) track of how the conversation evolved.
- Keep all decisions, ideas, and errors/blockers explicitly in the summary.
- Keep any code/codeblock snippets if they are crucial to the conversation.
- When a task spans multiple files, list the files.
- Preserve all user requests exactly.
- Keep your summary under 800 words.
- Output only the summary, nothing else.`;

const BUILT_IN_AGENTS: Agent[] = [
  {
    name: 'office',
    description: 'Office document assistant',
    system: OFFICE_SYSTEM,
    permission: [
      { tool: '*', action: 'allow' },
      { tool: 'bash', action: 'deny' },
      { tool: 'edit', action: 'deny' },
    ],
  },
  {
    name: 'developer',
    description: 'Development assistant with full capabilities',
    system: DEVELOPER_SYSTEM,
    permission: [{ tool: '*', action: 'allow' }],
  },
  {
    name: 'compaction',
    description: 'Session compaction summarizer',
    system: COMPACTION_SYSTEM,
    permission: [{ tool: '*', action: 'deny' }],
  },
];

export class AgentRegistry {
  private agents = new Map<string, Agent>();

  constructor() {
    for (const agent of BUILT_IN_AGENTS) {
      this.agents.set(agent.name, agent);
    }
  }

  get(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  getDefault(): Agent {
    return this.agents.get('office')!;
  }

  list(): Agent[] {
    return [...this.agents.values()];
  }

  filterTools(tools: ToolDefinition[], permission: Ruleset): ToolDefinition[] {
    return tools.filter((t) => evaluate(t.name, permission) === 'allow');
  }
}
