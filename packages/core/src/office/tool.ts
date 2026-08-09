import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '../tool';
import type { DraftManager } from '../draft';

const VERBS = [
  'open',
  'close',
  'save',
  'view',
  'get',
  'query',
  'set',
  'add',
  'remove',
  'move',
  'swap',
  'refresh',
  'validate',
  'batch',
  'dump',
  'import',
  'merge',
  'create',
  'raw',
  'raw-set',
  'help',
] as const;

export type OfficeVerb = (typeof VERBS)[number];

const MUTATING = new Set<OfficeVerb>([
  'set',
  'add',
  'remove',
  'move',
  'swap',
  'refresh',
  'save',
  'close',
  'batch',
  'import',
  'merge',
  'raw-set',
]);

export function isMutating(command: string): boolean {
  return MUTATING.has(command as OfficeVerb);
}

export function parseError(output: string): {
  error: string;
  code?: string;
  suggestion?: string;
} {
  if (!output) return { error: 'Unknown error' };
  try {
    const parsed = JSON.parse(output);
    if (parsed.error?.error) {
      return {
        error: parsed.error.error,
        code: parsed.error.code,
        suggestion: parsed.error.suggestion,
      };
    }
  } catch {
    // not JSON
  }
  return { error: output };
}

const VIEW_MODES = [
  'text',
  'annotated',
  'outline',
  'stats',
  'issues',
  'html',
  'svg',
  'screenshot',
  'pdf',
  'forms',
] as const;

export interface OfficeCliDeps {
  checkInstalled: () => Promise<boolean>;
  execCli: (args: string[], opts?: { timeout?: number }) => Promise<string>;
  draftManager?: DraftManager;
}

export function createOfficeCliTool(deps: OfficeCliDeps): ToolDefinition {
  return {
    name: 'officecli',
    description:
      "Create, read, and edit Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) documents. Verbs: get/query/view (read), set/add/remove/move/swap (edit), batch (multi-op), validate, dump, import, merge, create, raw/raw-set (XML fallback), open/close/save (resident lifecycle), help (capability reference). Use --json via 'props' for structured output. Run 'officecli help' when unsure about commands or properties.",
    parameters: z.object({
      command: z.enum(VERBS),
      file: z.string().optional().describe('Path to the document (merge uses template instead)'),
      path: z.string().optional().describe('DOM path (e.g., /body/p[@paraId=00100000])'),
      path2: z.string().optional().describe('Second DOM path (swap)'),
      selector: z.string().optional().describe('CSS-like selector (query)'),
      mode: z
        .enum(VIEW_MODES)
        .optional()
        .describe(
          'View mode: text, annotated, outline, stats, issues, html, svg, screenshot, pdf, forms',
        ),
      parent: z.string().optional().describe('Parent DOM path (add/import target)'),
      type: z
        .string()
        .optional()
        .describe('Element type to add (e.g., paragraph, run, table, slide, shape)'),
      props: z
        .record(z.string(), z.any())
        .optional()
        .describe('Properties to set (passed as repeatable --prop key=value)'),
      find: z.string().optional().describe('Find this text/pattern to replace (set)'),
      replace: z.string().optional().describe('Replacement text for --find matches (set)'),
      from: z.string().optional().describe('Copy from an existing element path (add)'),
      to: z.string().optional().describe('Target parent path (move)'),
      index: z.string().optional().describe('Insert position, 0-based (add/move)'),
      after: z.string().optional().describe('Insert/move after the element at this path'),
      before: z.string().optional().describe('Insert/move before the element at this path'),
      operations: z
        .array(z.any())
        .optional()
        .describe('Batch operations (passed as --commands JSON)'),
      part: z.string().optional().describe('Document part path (raw/raw-set, e.g., /document)'),
      xpath: z.string().optional().describe('XPath to target elements (raw-set)'),
      action: z
        .enum(['append', 'prepend', 'insertbefore', 'insertafter', 'replace', 'remove', 'setattr'])
        .optional()
        .describe('XML action (raw-set)'),
      xml: z.string().optional().describe('XML fragment or attr=value (raw-set)'),
      source: z.string().optional().describe('Source CSV/TSV file to import (import)'),
      template: z.string().optional().describe('Template file with {{key}} placeholders (merge)'),
      output: z.string().optional().describe('Output file path (merge)'),
      data: z.string().optional().describe('JSON data or path to .json file (merge)'),
      format: z.string().optional().describe('Format for help (docx, xlsx, pptx)'),
      query: z.string().optional().describe('Alias for selector (query)'),
      content: z.string().optional().describe('Deprecated: use props instead'),
    }),
    execute: async (params, ctx): Promise<ToolResult> => {
      if (!(await deps.checkInstalled())) {
        return {
          success: false,
          error:
            'officecli is not installed. Install: curl -fsSL https://d.officecli.ai/install.sh | bash',
          code: 'NOT_INSTALLED',
        };
      }

      const cmd = params.command;

      // Draft interception: mutating/open/create commands run against a draft
      // copy; reads follow the draft once one exists. merge targets the output
      // path via template, not params.file — left outside the draft path.
      let file = params.file;
      if (deps.draftManager && file && cmd !== 'merge') {
        const createsDraft = isMutating(cmd) || cmd === 'open' || cmd === 'create';
        const resolved = await deps.draftManager.resolve(file, ctx.sessionID, createsDraft);
        if (resolved.lockError) {
          return {
            success: false,
            error: resolved.lockError,
            code: 'LOCKED',
          };
        }
        file = resolved.path!;
      }

      const args: string[] = [cmd];

      if (cmd === 'merge') {
        args.push(params.template ?? '', params.output ?? '');
        if (params.data) args.push('--data', params.data);
      } else {
        args.push(file ?? '');
        if (cmd === 'create' && deps.draftManager && params.file) {
          // Drafts are born as empty files by resolve(); officecli create
          // refuses to overwrite an existing file unless --force is given.
          args.push('--force');
        }
        if (
          cmd === 'get' ||
          cmd === 'set' ||
          cmd === 'remove' ||
          cmd === 'move' ||
          cmd === 'dump'
        ) {
          if (params.path) args.push(params.path);
        } else if (cmd === 'query') {
          args.push(params.selector ?? params.query ?? '');
        } else if (cmd === 'view') {
          args.push(params.mode ?? 'text');
        } else if (cmd === 'swap') {
          args.push(params.path ?? '', params.path2 ?? '');
        } else if (cmd === 'import') {
          args.push(params.parent ?? '', params.source ?? '');
        } else if (cmd === 'add') {
          args.push(params.parent ?? '');
        } else if (cmd === 'raw' || cmd === 'raw-set') {
          if (params.part) args.push(params.part);
        } else if (cmd === 'help') {
          args.length = 1;
          if (params.format) args.push(params.format);
          if (params.path) args.push(params.path);
          if (params.type) args.push(params.type);
        }
      }

      if (params.type && cmd !== 'help') args.push('--type', params.type);
      if (params.from) args.push('--from', params.from);
      if (params.index !== undefined) args.push('--index', params.index);
      if (params.after) args.push('--after', params.after);
      if (params.before) args.push('--before', params.before);
      if (params.to) args.push('--to', params.to);
      if (params.find) args.push('--find', params.find);
      if (params.replace) args.push('--replace', params.replace);
      if (params.xpath) args.push('--xpath', params.xpath);
      if (params.action) args.push('--action', params.action);
      if (params.xml) args.push('--xml', params.xml);
      if (params.props) {
        for (const [key, value] of Object.entries(params.props)) {
          args.push('--prop', `${key}=${value}`);
        }
      }
      if (params.operations) args.push('--commands', JSON.stringify(params.operations));

      if (cmd !== 'help') args.push('--json');

      const timeout = cmd === 'batch' ? 60000 : 30000;

      try {
        const output = await deps.execCli(args, { timeout });
        const parsed = JSON.parse(output);
        if (parsed?.success === false) {
          return {
            success: false,
            error: parsed.error?.error ?? parsed.message ?? 'officecli reported failure',
            code: parsed.error?.code ?? parsed.code,
          };
        }
        return { success: true, output, data: parsed };
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          return {
            success: false,
            error:
              'officecli is not installed. Install: curl -fsSL https://d.officecli.ai/install.sh | bash',
            code: 'NOT_INSTALLED',
          };
        }

        const stdout = e.stdout ?? '';
        const parsed = parseError(stdout);
        return {
          success: false,
          error: parsed.error,
          code: parsed.code,
        };
      }
    },
  };
}
