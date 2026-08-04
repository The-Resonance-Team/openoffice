import { z } from "zod";
import type { ToolDefinition } from "../types";
import { generateHandoff } from "../../session/handoff";
import type { HandoffSummarizeFn } from "../../session/handoff";
import type { SessionStore } from "../../session/store";
import type { Config } from "../../config";

export interface HandoffDeps {
  store: SessionStore;
  config: Config;
  summarizeFn?: HandoffSummarizeFn;
}

export function createHandoffTool(deps: HandoffDeps): ToolDefinition {
  return {
    name: "handoff",
    description:
      "Write a handoff document for the current session so a fresh session can continue the work. Saves a Markdown file to the OS temporary directory and returns its path.",
    parameters: z.object({
      focus: z
        .string()
        .optional()
        .describe("What the next session will focus on"),
    }),
    execute: async (params, ctx) => {
      const session = deps.store.load(ctx.sessionID);
      if (!session) {
        return {
          success: false,
          error: `No session "${ctx.sessionID}" found`,
          code: "HANDOFF_NO_SESSION",
        };
      }
      try {
        const { path } = await generateHandoff({
          session,
          config: deps.config,
          summarizeFn: deps.summarizeFn,
          focus: params.focus,
        });
        return { success: true, output: `Handoff written to ${path}` };
      } catch (e: any) {
        return {
          success: false,
          error: e.message ?? "Handoff generation failed",
          code: "HANDOFF_ERROR",
        };
      }
    },
  };
}
