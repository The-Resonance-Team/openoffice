import { extname } from 'node:path';
import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '../types';
import { errorMessage } from '../../errors';

const LEGACY_MAP: Record<string, string> = {
  '.doc': 'docx',
  '.dot': 'docx',
  '.xls': 'xlsx',
  '.xlt': 'xlsx',
  '.ppt': 'pptx',
  '.pot': 'pptx',
};

const FORMATS = ['docx', 'xlsx', 'pptx'] as const;
const MODERN = new Set<string>(FORMATS.map((f) => `.${f}`));

export interface ConvertDeps {
  askUser: (question: string) => Promise<string>;
  convertFile: (file: string, format: string) => Promise<string>;
}

const convertSchema = z.object({
  file: z.string().describe('Path to the legacy Office file'),
  format: z
    .enum(FORMATS)
    .optional()
    .describe('Target format (docx, xlsx, pptx). Inferred from the file extension if omitted.'),
});

export function createConvertTool(deps: ConvertDeps): ToolDefinition<typeof convertSchema> {
  return {
    name: 'convert',
    description:
      'Convert a legacy Office file (.doc/.dot/.xls/.xlt/.ppt/.pot) to the modern OpenXML format (.docx/.xlsx/.pptx). Asks the user for confirmation before converting.',
    parameters: convertSchema,

    execute: async (params): Promise<ToolResult> => {
      const sourceExt = extname(params.file).toLowerCase();

      if (MODERN.has(sourceExt)) {
        return {
          success: false,
          error: `"${params.file}" is already a modern Office format; nothing to convert`,
          code: 'NOT_LEGACY',
        };
      }

      const target = params.format ?? LEGACY_MAP[sourceExt];
      if (!target) {
        return {
          success: false,
          error: `Unsupported source format "${sourceExt}". Convert from: ${Object.keys(LEGACY_MAP).join(', ')}`,
          code: 'UNSUPPORTED_SOURCE_FORMAT',
        };
      }

      try {
        const answer = (await deps.askUser(`Convert ${params.file} to .${target}? (y/N)`))
          .trim()
          .toLowerCase();
        if (answer !== 'y' && answer !== 'yes') {
          return {
            success: false,
            error: 'Conversion cancelled by user',
            code: 'CANCELLED',
          };
        }
      } catch (e: unknown) {
        return {
          success: false,
          error: errorMessage(e) || 'Failed to ask user',
          code: 'QUESTION_ERROR',
        };
      }

      try {
        const output = await deps.convertFile(params.file, target);
        return { success: true, output: `Converted to ${output}` };
      } catch (e: unknown) {
        return {
          success: false,
          error: errorMessage(e) || 'Conversion failed',
          code: 'CONVERT_ERROR',
        };
      }
    },
  };
}
