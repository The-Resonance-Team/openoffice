import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, extname } from 'node:path';

import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '../types';
import { errorMessage } from '../../errors';
import { OFFICE_EXTENSIONS, LEGACY_OFFICE_EXTENSIONS } from './read';

const writeSchema = z.object({
  file: z.string().describe('Path to the file to write'),
  content: z.string().describe('Content to write'),
});

export function createWriteTool(): ToolDefinition<typeof writeSchema> {
  return {
    name: 'write',
    description:
      'Write content to a file. Creates parent directories if needed. For Office documents (.docx/.xlsx/.pptx) use officecli instead.',
    parameters: writeSchema,

    execute: async (params): Promise<ToolResult> => {
      const ext = extname(params.file).toLowerCase();
      if (OFFICE_EXTENSIONS.has(ext) || LEGACY_OFFICE_EXTENSIONS.has(ext)) {
        return {
          success: false,
          error: 'Office documents cannot be written as text. Use the officecli tool instead',
          code: 'OFFICE_FORMAT',
        };
      }
      try {
        mkdirSync(dirname(params.file), { recursive: true });
        writeFileSync(params.file, params.content, 'utf-8');
        return {
          success: true,
          output: `Wrote ${params.content.length} bytes to ${params.file}`,
        };
      } catch (e: unknown) {
        return {
          success: false,
          error: errorMessage(e) || 'Failed to write file',
          code: 'WRITE_ERROR',
        };
      }
    },
  };
}
