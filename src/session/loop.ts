import { randomUUID } from "node:crypto";
import { chat as defaultChat } from "../llm/chat";
import type { ChatOptions } from "../llm/chat";
import type { ToolRegistry } from "../tool/registry";
import type { SessionStore } from "./store";
import type { Session } from "./types";
import { emit } from "../events";
import type { Config } from "../config";
import { maybeCompact, summarize as defaultSummarize } from "./compact";

export interface RunTurnOptions {
  session: Session;
  userMessage: string;
  store: SessionStore;
  tools?: ToolRegistry;
  system?: string;
  config: Config;
  chatFn?: (options: ChatOptions, config: Config) => any;
  summarizeFn?: typeof defaultSummarize;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
}

export async function runTurn(options: RunTurnOptions) {
  const {
    session,
    userMessage,
    store,
    tools,
    system,
    config,
    chatFn = defaultChat,
    summarizeFn,
    fetchFn,
  } = options;
  const now = Date.now();

  // Prune/compact the persisted history before the new user message is
  // appended, so the protected tail is the last completed turns. Skipped when
  // the last known usage is under the model's usable context window.
  await maybeCompact({ session, store, config, summarizeFn, fetchFn });

  // Append user message with seq
  const userMsgId = randomUUID();
  const userMsg = { role: "user" as const, content: userMessage };
  const userSeq = store.nextSeq(session.id);
  store.appendMessage(session.id, userMsgId, userMsg, now, userSeq);
  session.messages.push(userMsg);

  emit("session:message", {
    sessionID: session.id,
    role: "user",
    content: userMessage,
  });

  // Build AI tools with event emission
  const aiTools = tools?.toAIToolsWithEvents(session.id, session.cwd);

  // Call LLM
  const result = chatFn(
    {
      model: session.model,
      messages: session.messages,
      tools: aiTools,
      system,
    },
    config
  );

  // Stream tokens
  let fullText = "";
  for await (const chunk of result.textStream) {
    fullText += chunk;
    emit("llm:token", { sessionID: session.id, token: chunk });
  }

  // responseMessages = accumulated generated messages (assistant + tool calls + tool results)
  const generatedMessages = await result.responseMessages;

  // Persist generated messages with seq
  let seq = store.nextSeq(session.id);
  let lastAssistantSeq: number | null = null;
  for (const msg of generatedMessages) {
    const msgId = randomUUID();
    store.appendMessage(session.id, msgId, msg as any, Date.now(), seq);
    session.messages.push(msg as any);
    if (msg.role === "assistant") lastAssistantSeq = seq;
    seq++;
  }

  // Persist token usage on the final assistant message so the next turn knows
  // where it stands without re-estimating the history.
  const usage = await result.usage;
  if (usage && lastAssistantSeq !== null) {
    store.setTokens(session.id, lastAssistantSeq, {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    });
  }

  emit("llm:done", { sessionID: session.id, response: fullText });

  // Save session
  session.updatedAt = Date.now();
  store.save(session);

  return { text: fullText, session };
}
