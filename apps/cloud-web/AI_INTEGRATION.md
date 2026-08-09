# AI Integration

## Setup

1. Get your Vercel AI Gateway API key from https://vercel.com/ai-gateway
2. Create `.env.local` in `apps/cloud-web/`:
   ```
   AI_GATEWAY_API_KEY=your_key_here
   ```

## Features Implemented

### ✅ Chat UI

- **Route**: `/api/chat` - Uses AI Gateway with Claude Sonnet 4.5
- **Component**: `ChatPanel` - Basic chat interface with message history
- **Access**: Dashboard → Chat tab

### Architecture

- **Provider**: AI Gateway (built into `ai` package) - no extra dependencies
- **Model**: `anthropic/claude-sonnet-4.5` (can be changed in route)
- **Streaming**: Full streaming support via `streamText`

## Available AI SDK Features (Not Yet Implemented)

The AI SDK v7 provides additional capabilities that can be added as needed:

1. **Agents** - ToolLoopAgent for multi-step workflows
2. **Tools** - Function calling for external actions
3. **Structured Output** - Generate typed JSON objects
4. **Embeddings** - Vector embeddings for search/RAG
5. **Multi-modal** - Image, video, speech processing

## Usage

Start the dev server:

```bash
bun run dev
```

Navigate to http://localhost:5202/app → Click "Chat" tab → Start chatting

## Changing Models

Edit `apps/cloud-web/app/api/chat/route.ts` and change the model string:

```ts
// Available models (see https://ai-gateway.vercel.sh/v1/models)
model: 'anthropic/claude-sonnet-4.5'; // Current
model: 'openai/gpt-5.1'; // Alternative
model: 'google/gemini-2.5-flash'; // Alternative
```

## Next Steps (If Needed)

- **Session persistence**: Store chat history in cloud-api
- **Agent workflows**: Add ToolLoopAgent for document processing
- **Structured output**: Generate session metadata as typed objects
- **File uploads**: Add document attachment support

---

**Implementation note**: This follows the ponytail principle - start with the simplest solution (AI Gateway + basic chat), add complexity only when needed. No agent frameworks, no tool calling, no structured output - just streaming chat. YAGNI.
