import { Glob } from 'bun';
import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '../types';
import { errorMessage } from '../../errors';

const globSchema = z.object({
  pattern: z.string().describe('Glob pattern (e.g., **/*.ts, src/**/*.test.ts)'),
  path: z.string().optional().describe('Directory to search in (defaults to cwd)'),
});

export function createGlobTool(): ToolDefinition<typeof globSchema> {
  return {
    name: 'glob',
    description:
      'Find files by glob pattern. Returns matching file paths. Use ** for recursive matching.',
    parameters: globSchema,

    execute: async (params, ctx): Promise<ToolResult> => {
      try {
        const glob = new Glob(params.pattern);
        const matches: string[] = [];
        for await (const match of glob.scan({
          cwd: params.path ?? ctx.cwd ?? process.cwd(),
        })) {
          matches.push(match);
        }
        return {
          success: true,
          output: matches.length > 0 ? matches.join('\n') : 'No files found',
          data: matches,
        };
      } catch (e: unknown) {
        return {
          success: false,
          error: errorMessage(e) || 'Failed to search files',
          code: 'GLOB_ERROR',
        };
      }
    },
  };
}
