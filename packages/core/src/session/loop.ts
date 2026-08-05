import { randomUUID } from "node:crypto";
import { chat as defaultChat } from "../llm/chat";
import type { ChatOptions } from "../llm/chat";
import type { ToolRegistry } from "../tool/registry";
import type { SessionStore } from "./store";
import type { Session } from "./types";
import { emit } from "../events";
import type { Config } from "../config";
import type { AgentRegistry } from "../agent/registry";
import { getModel, splitModel } from "../llm/model-limits";
import {
  applyPrune,
  create,
  process,
  prune,
  type CompactionDeps,
} from "./compaction";
import { isOverflow } from "./overflow";
import { filterCompacted, toModelMessages } from "./ai-messages";
import type { Part, ToolPart } from "./parts";

export interface RunTurnOptions {
  session: Session;
  userMessage: string;
  store: SessionStore;
  agents: AgentRegistry;
  tools?: ToolRegistry;
  system?: string;
  config: Config;
  chatFn?: (
    options: ChatOptions,
    config: Config
  ) => ReturnType<typeof defaultChat>;
}

export async function runTurn(options: RunTurnOptions) {
  const {
    session,
    userMessage,
    store,
    agents,
    tools,
    system,
    config,
    chatFn = defaultChat,
  } = options;
  const model = getModel(session.model);
  const now = Date.now();

  // Load history once — reused across prune, overflow check, and request.
  const history = store.messages(session.id);

  // Prune old tool outputs, then auto-compact when the last completed turn
  // overflowed the model's usable context — before the new user message is
  // appended, so the protected tail is the last completed turns.
  applyPrune(store, session.id, prune(history, config));

  const lastTokens = [...history].reverse().find((msg) => msg.info.tokens)
    ?.info.tokens;
  if (lastTokens && isOverflow(config.compaction, lastTokens, model)) {
    const parentID = create(
      {
        sessionID: session.id,
        agent: "compaction",
        model: getModel(session.model),
        auto: true,
      },
      store
    );
    await process(
      {
        sessionID: session.id,
        parentID,
        messages: store.messages(session.id),
        model: session.model,
        auto: true,
      },
      { store, config, agents, chat: chatFn }
    );
  }

  // Append the user message
  const userMsgId = randomUUID();
  store.updateMessage(session.id, {
    id: userMsgId,
    role: "user",
    agent: session.agent,
    model: splitModelRef(session.model),
    time: { created: now },
  });
  store.updatePart(session.id, userMsgId, { type: "text", text: userMessage });

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
      messages: toModelMessages(filterCompacted(store.messages(session.id))),
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

  // Persist generated messages; tool parts keep their callID so the matching
  // tool result can be filled in.
  let assistantId: string | null = null;
  const pending = new Map<string, string>(); // toolCallId -> part id
  for (const msg of generatedMessages) {
    if (msg.role === "assistant") {
      assistantId = randomUUID();
      // Parent row first: parts reference the message (FK), and updatePart
      // for tool-call parts runs below while streaming tool state.
      store.updateMessage(session.id, {
        id: assistantId,
        role: "assistant",
        parentID: userMsgId,
        agent: session.agent,
        model: splitModelRef(session.model),
        finish: "done",
        time: { created: Date.now() },
      });
      const parts: Part[] = [];
      // AssistantContent can be string | Array<...>
      if (typeof msg.content === "string") {
        parts.push({ type: "text", text: msg.content });
      } else {
        for (const content of msg.content) {
          if (content.type === "text") {
            parts.push({ type: "text", text: content.text });
          } else if (content.type === "tool-call") {
            const part: ToolPart = {
              type: "tool",
              tool: content.toolName,
              callID: content.toolCallId,
              state: {
                status: "pending",
                input: content.input as string | Record<string, unknown>,
              },
            };
            const partId = store.updatePart(session.id, assistantId, part);
            pending.set(content.toolCallId, partId);
          }
        }
      }
      for (const part of parts) {
        store.updatePart(session.id, assistantId, part);
      }
    } else if (msg.role === "tool") {
      for (const content of msg.content) {
        if (content.type !== "tool-result") continue;
        const partId = pending.get(content.toolCallId);
        if (!partId || !assistantId) continue;
        const output = content.output;
        let value: string;
        let isError = false;
        if (output.type === "text") {
          value = output.value;
        } else if (output.type === "json") {
          value = JSON.stringify(output.value);
        } else if (output.type === "execution-denied") {
          value = output.reason ?? "Tool execution denied";
          isError = true;
        } else if (output.type === "error-text") {
          value = output.value;
          isError = true;
        } else {
          value = JSON.stringify(output);
        }
        store.updatePart(session.id, assistantId, {
          id: partId,
          type: "tool",
          tool: content.toolName,
          callID: content.toolCallId,
          state: isError
            ? {
                status: "error",
                input: "",
                error: { message: value },
              }
            : { status: "completed", input: "", output: value },
        });
      }
    }
  }

  // Persist token usage on the final assistant message so the next turn knows
  // where it stands without re-estimating the history.
  const usage = await result.usage;
  if (usage && assistantId) {
    store.updateMessage(session.id, {
      id: assistantId,
      role: "assistant",
      agent: session.agent,
      model: splitModelRef(session.model),
      finish: "done",
      time: { created: Date.now() },
      tokens: {
        input: usage.inputTokens ?? 0,
        output: usage.outputTokens ?? 0,
      },
    });
  }

  emit("llm:done", { sessionID: session.id, response: fullText });

  // Save session
  session.updatedAt = Date.now();
  store.save(session);

  return { text: fullText, session };
}

function splitModelRef(model: string): { providerID: string; modelID: string } {
  const [providerID, modelID] = splitModel(model);
  return { providerID, modelID };
}
