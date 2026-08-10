import type { ToolContext, ToolDefinition, ToolResult } from './types';

export async function executeTool(
  def: ToolDefinition,
  params: unknown,
  // ponytail: empty sessionID default — safe only for tools that ignore ctx;
  // runTurn always passes the real session via toAIToolsWithEvents
  ctx: ToolContext = { sessionID: '' },
): Promise<ToolResult> {
  const parsed = def.parameters.safeParse(params);
  if (!parsed.success) {
    return {
      success: false,
      error: `Invalid parameters: ${parsed.error.message}`,
      code: 'VALIDATION_ERROR',
    };
  }
  try {
    return await def.execute(parsed.data, ctx);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      code: 'EXECUTION_ERROR',
    };
  }
}
