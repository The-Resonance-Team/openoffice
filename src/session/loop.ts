import { randomUUID } from "node:crypto";
import { chat as defaultChat } from "../llm/chat";
import type { ChatOptions } from "../llm/chat";
import type { ToolRegistry } from "../tool/registry";
import type { SessionStore } from "./store";
import type { Session } from "./types";
import { emit } from "../events";
import type { Config } from "../config";

export interface RunTurnOptions {
  session: Session;
  userMessage: string;
  store: SessionStore;
  tools?: ToolRegistry;
  system?: string;
  config: Config;
  chatFn?: (options: ChatOptions, config: Config) => any;
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
  } = options;
  const now = Date.now();

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
  const aiTools = tools?.toAIToolsWithEvents(session.id);

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
  for (const msg of generatedMessages) {
    const msgId = randomUUID();
    store.appendMessage(session.id, msgId, msg as any, Date.now(), seq++);
    session.messages.push(msg as any);
  }

  emit("llm:done", { sessionID: session.id, response: fullText });

  // Save session
  session.updatedAt = Date.now();
  store.save(session);

  return { text: fullText, session };
}
