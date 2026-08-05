import { z } from "zod";

export const ProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  region: z.string().optional(),
  compatibility: z.enum(["openai", "anthropic"]).optional(),
});

export const UpdateConfigSchema = z.object({
  check: z.boolean().optional(),
});

export const AgentConfigSchema = z.object({
  description: z.string().optional(),
  tools: z.array(z.string()).optional(),
  model: z.string().optional(),
});

export const McpConfigSchema = z.object({
  type: z.enum(["local", "remote"]),
  command: z.array(z.string()).optional(),
  url: z.string().optional(),
  environment: z.record(z.string(), z.string()).optional(),
});

export const OfficeConfigSchema = z.object({
  managedDocumentsFolder: z.string().optional(),
});

export const CompactionConfigSchema = z.object({
  auto: z.boolean().optional(),
  prune: z.boolean().optional(),
  pruneProtectTokens: z.number().optional(),
  pruneMinimumTokens: z.number().optional(),
  tailTurns: z.number().optional(),
  preserveRecentTokens: z.number().optional(),
  reservedTokens: z.number().optional(),
  windows: z
    .record(
      z.string(),
      z.object({
        context: z.number(),
        output: z.number(),
      })
    )
    .optional(),
});

export const ConfigSchema = z.object({
  model: z.string().optional(),
  llm: z
    .object({
      retry: z
        .object({
          max: z.number().int().positive().optional(),
        })
        .optional(),
    })
    .optional(),
  provider: z.record(z.string(), ProviderConfigSchema).optional(),
  agent: z.record(z.string(), AgentConfigSchema).optional(),
  mcp: z.record(z.string(), McpConfigSchema).optional(),
  office: OfficeConfigSchema.optional(),
  compaction: CompactionConfigSchema.optional(),
  update: UpdateConfigSchema.optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
