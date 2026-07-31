import { z } from "zod";

export const ProviderConfigSchema = z.object({
  apiKey: z.string(),
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
});

export const OfficeConfigSchema = z.object({
  managedDocumentsFolder: z.string().optional(),
});

export const ConfigSchema = z.object({
  model: z.string().optional(),
  provider: z.record(z.string(), ProviderConfigSchema).optional(),
  agent: z.record(z.string(), AgentConfigSchema).optional(),
  mcp: z.record(z.string(), McpConfigSchema).optional(),
  office: OfficeConfigSchema.optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
