import type { Agent } from '../agent';
import { listSkills, formatSkillList } from '../skills';
import type { McpManager } from '../mcp';

export interface SystemPromptOptions {
  agent: Agent;
  skillsDir?: string;
  mcp?: McpManager;
  cwd?: string;
}

export function buildSystemPrompt(options: SystemPromptOptions): string {
  const parts: string[] = [];

  // 1. Agent's base system prompt
  parts.push(options.agent.system);

  // 2. Environment context
  const env = [
    `Working directory: ${options.cwd ?? process.cwd()}`,
    `Date: ${new Date().toISOString().split('T')[0]}`,
  ];
  parts.push(env.join('\n'));

  // 3. Available skills
  if (options.skillsDir) {
    const skills = listSkills(options.skillsDir);
    const skillList = formatSkillList(skills);
    if (skillList) {
      parts.push(
        'Skills provide specialized instructions and workflows for specific tasks.\n' +
          'Use the skill tool to load a skill when a task matches its description.\n\n' +
          skillList,
      );
    }
  }

  // 4. MCP server instructions
  if (options.mcp) {
    const connected = Object.entries(options.mcp.status())
      .filter(([, info]) => info.status === 'connected')
      .map(([name]) => name);
    if (connected.length > 0) {
      parts.push(
        `<mcp_instructions>\n${connected
          .map((s) => `  <server name="${s}">\n    Connected.\n  </server>`)
          .join('\n')}\n</mcp_instructions>`,
      );
    }
  }

  return parts.join('\n\n');
}
