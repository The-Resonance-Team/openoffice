import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '../tool';
import { loadSkill } from './loader';

const skillSchema = z.object({
  name: z.string().describe('The name of the skill to load'),
});

export function createSkillTool(skillsDir: string): ToolDefinition<typeof skillSchema> {
  return {
    name: 'skill',
    description:
      'Load a specialized skill when the task at hand matches its description. Use this to get detailed instructions for specific tools or domains.',
    parameters: skillSchema,
    execute: async (params): Promise<ToolResult> => {
      const skill = loadSkill(skillsDir, params.name);
      if (!skill) {
        return {
          success: false,
          error: `Skill "${params.name}" not found`,
          code: 'SKILL_NOT_FOUND',
        };
      }
      return {
        success: true,
        output: `<skill_content name="${skill.name}">${skill.content}</skill_content>`,
      };
    },
  };
}
