import { z } from 'zod';
import type { ToolDefinition } from '../tool';
import { loadSkill } from './loader';

export function createSkillTool(skillsDir: string): ToolDefinition {
  return {
    name: 'skill',
    description:
      'Load a specialized skill when the task at hand matches its description. Use this to get detailed instructions for specific tools or domains.',
    parameters: z.object({
      name: z.string().describe('The name of the skill to load'),
    }),
    execute: async (params) => {
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
