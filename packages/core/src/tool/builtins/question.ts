import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '../types';
import { errorMessage } from '../../errors';

export interface QuestionDeps {
  askUser: (question: string) => Promise<string>;
}

const questionSchema = z.object({
  question: z.string().describe('The question to ask the user'),
});

export function createQuestionTool(deps: QuestionDeps): ToolDefinition<typeof questionSchema> {
  return {
    name: 'question',
    description:
      'Ask the user a question and wait for their response. Use this when you need clarification or input from the user.',
    parameters: questionSchema,

    execute: async (params): Promise<ToolResult> => {
      try {
        const answer = await deps.askUser(params.question);
        return { success: true, output: answer };
      } catch (e: unknown) {
        return {
          success: false,
          error: errorMessage(e) || 'Failed to get answer',
          code: 'QUESTION_ERROR',
        };
      }
    },
  };
}
