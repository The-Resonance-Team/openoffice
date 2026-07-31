import { randomUUID } from "node:crypto";
import { chat } from "../llm/chat";
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
}

export async function runTurn(options: RunTurnOptions) {
  const { session, userMessage, store, tools, system, config } = options;
  const now = Date.now();

  // Append user message
  const userMsgId = randomUUID();
  const userMsg = { role: "user" as const, content: userMessage };
  store.appendMessage(session.id, userMsgId, userMsg, now);
  session.messages.push(userMsg);

  emit("session:message", {
    sessionID: session.id,
    role: "user",
    content: userMessage,
  });

  // Snapshot message count before LLM call — response.messages includes full history
  const prevCount = session.messages.length;

  // Build AI tools with event emission
  const aiTools = tools?.toAIToolsWithEvents(session.id);

  // Call LLM
  const result = chat(
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

  // response.messages = full conversation history (original + new)
  const response = await result.response;
  const newMessages = response.messages.slice(prevCount);

  // Persist new messages (assistant text, tool calls, tool results)
  for (const msg of newMessages) {
    const msgId = randomUUID();
    store.appendMessage(session.id, msgId, msg as any, Date.now());
    session.messages.push(msg as any);
  }

  emit("llm:done", { sessionID: session.id, response: fullText });

  // Save session
  session.updatedAt = Date.now();
  store.save(session);

  return { text: fullText, session };
}
