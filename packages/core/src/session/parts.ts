// The part data model lives in @openoffice/schema; this module is the session
// store's view over it (ADR 0033: the agent engine lives in the base, the
// store persists the wire transcript for share replay and the mirror).
export type {
  Role,
  ModelRef,
  TokenUsage,
  MessageInfo,
  PartBase,
  TextPart,
  ToolState,
  ToolPart,
  CompactionPart,
  Part,
  WithParts,
} from '@openoffice/schema';
