// @openoffice/core — the engine. Package entry; cross-package importers use
// this surface only. Domains inside stay deep modules: intra-package imports
// reach domains only through their root entry files, never subfolder internals.

export type { Agent } from './agent';
export { AgentRegistry, evaluate, fromConfig, merge } from './agent';
export type { Ruleset, Rule, Action } from './agent';

export { CredentialStore } from './auth/store';
export type { ApiCredential } from './auth/store';
export { login } from './auth/login';

export { ConfigSchema, resolveConfig, collectEnvValues, shareMode } from './config';
export type { Config, ResolveOptions, ShareMode } from './config';
export {
  stripJsonc,
  applyEnvOverrides,
  findProjectConfig,
  loadConfigFiles,
  mergeLayers,
} from './config/loader';

export { DraftManager, filePathHash, LOCKED_ERROR, LockManager } from './draft';
export type {
  DraftMeta,
  DraftManagerDeps,
  ResolveResult,
  AcceptResult,
  LockInfo,
  AcquireResult,
} from './draft';

export { on, emit, setSensitiveValues } from './events';
export type { EventMap } from './events';

export { errorMessage } from './errors';

export { HistoryStore } from './history';
export type { AcceptPoint } from './history';

export { ShareStore } from './share';
export { shareViewerPage } from './share';

export {
  resolveModel,
  resolveCredential,
  BUILTIN_PROVIDERS,
  AuthRequiredError,
  chat,
  complete,
  getModel,
  splitModel,
  maxOutputTokens,
  discoverLocalModels,
} from './llm';
export type { ChatOptions, CompleteOptions, Model, ModelLimits, DiscoveredModel } from './llm';

export {
  McpManager,
  createSdkMcpClient,
  planMcpConnections,
  normalizeMcpResult,
  normalizeMcpContents,
} from './mcp';
export type {
  McpClient,
  McpConfig,
  McpToolInfo,
  McpPromptInfo,
  McpResourceInfo,
  McpManagerDeps,
  McpServerStatus,
  McpServerStatusInfo,
  McpResourceContent,
} from './mcp';

export {
  createOfficeCliTool,
  createDefaultOfficeCliTool,
  isMutating,
  parseError,
  checkInstalled,
  resetCache,
} from './office';
export type { OfficeCliDeps } from './office';

export { readOcr, OcrError, type OcrDeps } from './ocr';

export {
  SessionStore,
  runTurn,
  isStaleSession,
  SESSION_STALE_AFTER_MS,
  buildSystemPrompt,
  create,
  process,
  prune,
  applyPrune,
  select,
  buildPrompt,
  isOverflow,
  usable,
  toModelMessages,
  filterCompacted,
  truncateToolOutput,
  PRUNE_MINIMUM,
  PRUNE_PROTECT,
  SUMMARY_OUTPUT_TOKENS,
} from './session';
export type {
  Session,
  RunTurnOptions,
  CompactionDeps,
  ProcessInput,
  ProcessResult,
  OverflowConfig,
  Part,
  TextPart,
  ToolPart,
  CompactionPart,
  WithParts,
  MessageInfo,
  ModelRef,
  TokenUsage,
  ToolState,
} from './session';

export { loadSkill, listSkills, formatSkillList, createSkillTool } from './skills';
export type { Skill } from './skills';

export {
  ToolRegistry,
  executeTool,
  createReadTool,
  createWriteTool,
  createGlobTool,
  createGrepTool,
  createQuestionTool,
  createConvertTool,
  createTodoTool,
  IMAGE_EXTENSIONS,
} from './tool';
export type { ToolDefinition, ToolResult, ReadDeps, QuestionDeps, ConvertDeps } from './tool';
