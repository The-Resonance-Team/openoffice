import { z } from "zod";
import type { ToolDefinition } from "../types";

export interface QuestionDeps {
  askUser: (question: string) => Promise<string>;
}

export function createQuestionTool(deps: QuestionDeps): ToolDefinition {
  return {
    name: "question",
    description:
      "Ask the user a question and wait for their response. Use this when you need clarification or input from the user.",
    parameters: z.object({
      question: z.string().describe("The question to ask the user"),
    }),
    execute: async (params) => {
      try {
        const answer = await deps.askUser(params.question);
        return { success: true, output: answer };
      } catch (e: unknown) {
        return {
          success: false,
          error: (e as Error).message ?? "Failed to get answer",
          code: "QUESTION_ERROR",
        };
      }
    },
  };
}
