# Convex AI Agent System

## Overview
This implementation provides a scalable, production-ready AI agent system built on top of Convex's official agent component. It follows best practices from the Convex documentation and provides a solid foundation for building multiple AI-powered features.

## Architecture

### Core Components

1. **Agent Factory** (`agents/factory.ts`)
   - Centralized agent creation with consistent configuration
   - Pre-defined agent types: summary, general, research, analysis, creative
   - Easy to add new agent types

2. **Note Summary Agent** (`agents/noteSummary.ts`)
   - Specialized agent for note summarization
   - Supports both basic and structured summaries
   - Thread-based conversation history

3. **Thread Management** (`threads.ts`)
   - Persistent conversation history
   - User-scoped threads
   - Message streaming support

4. **Chat Actions** (`chat/basic.ts`, `chat/streaming.ts`)
   - Basic synchronous chat
   - Real-time streaming responses
   - Async message generation

5. **Reusable Tools** (`ai/tools.ts`)
   - Database operations (search, create, delete notes)
   - Analysis tools
   - Extensible tool system

## Usage Examples

### 1. Creating a Note with AI Summary

```typescript
// In your mutation
const noteId = await ctx.db.insert("notes", { 
  userId, 
  title, 
  content 
});

if (generateSummary) {
  await ctx.scheduler.runAfter(0, internal.notes.generateNoteSummaryWithAgent, {
    noteId,
    title,
    content,
    userId,
  });
}
```

### 2. Using Different Agent Types

```typescript
import { AgentFactory } from "./agents/factory";

// Create different types of agents
const summaryAgent = AgentFactory.create('summary');
const researchAgent = AgentFactory.create('research');
const creativeAgent = AgentFactory.create('creative');

// Use them with different prompts
const result = await summaryAgent.generateText(
  ctx,
  { threadId, userId },
  { prompt: "Summarize this article..." }
);
```

### 3. Streaming Responses

```typescript
const agent = AgentFactory.create('general');

const result = await agent.streamText(
  ctx,
  { threadId, userId },
  { prompt },
  {
    saveStreamDeltas: {
      chunking: "word",
      throttleMs: 100,
    },
  }
);
```

### 4. Using Tools with Agents

```typescript
import { noteTools } from "./ai/tools";

const agentWithTools = AgentFactory.createCustom({
  name: "Assistant with Tools",
  instructions: "You can search and manage notes.",
  tools: noteTools,
});
```

## Adding New Agents

To add a new agent type:

1. Add the type to `AgentType` in `factory.ts`
2. Define configuration in `agentConfigurations`
3. Create a specialized file if needed (like `noteSummary.ts`)

Example:
```typescript
// In factory.ts
export type AgentType = 'summary' | 'general' | 'research' | 'analysis' | 'creative' | 'translator';

const agentConfigurations = {
  // ... existing configs
  translator: {
    name: "Translation Agent",
    instructions: "You are a professional translator...",
  },
};
```

## RAG (Future Implementation)

The system is RAG-ready with:
- Placeholder configuration in `ai/rag.ts`
- Vector search enabled in agent config
- Embedding model configured
- Thread-based context retrieval

When ready to implement RAG:
1. Install `@convex-dev/rag` component
2. Update `rag.ts` with actual implementation
3. Use `searchContext` in agent tools

## Environment Variables

Required in `.env.local`:
```
OPENAI_API_KEY=your-api-key
```

## API Endpoints

### Threads
- `createNewThread` - Create a conversation thread
- `listUserThreads` - List all user threads
- `listThreadMessages` - Get messages with streaming support
- `deleteThread` - Delete a thread

### Chat
- `chat.basic.sendMessage` - Send message and generate response
- `chat.streaming.initiateStreamingMessage` - Stream responses
- `chat.basic.generateNoteSummary` - Generate note summary

### Examples
See `agents/example.ts` for complete usage examples:
- Note summarization
- Multiple agent types
- Agents with tools
- Streaming responses
- Agent chaining

## Frontend Integration

For React components:
```typescript
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";

const messages = useThreadMessages(
  api.threads.listThreadMessages,
  { threadId },
  { stream: true }
);

// Display messages
{toUIMessages(messages.results ?? []).map((message) => (
  <div key={message.key}>{message.text}</div>
))}
```

## Best Practices

1. **Always use threads** for conversation history
2. **Use the factory** for consistent agent creation
3. **Stream responses** for better UX
4. **Handle errors gracefully** in agent responses
5. **Use tools** for database operations
6. **Monitor usage** through the usage handler

## Testing

Run the examples:
```typescript
// Test note summary
convex run agents:example:exampleNoteSummary

// Test multiple agents
convex run agents:example:exampleMultipleAgents

// Test streaming
convex run agents:example:exampleStreaming
```

## Future Enhancements

- [ ] Implement RAG with document ingestion
- [ ] Add workflow orchestration
- [ ] Implement human-in-the-loop tools
- [ ] Add more specialized agents
- [ ] Implement usage analytics dashboard
- [ ] Add agent performance monitoring

## Support

For issues or questions:
- Check the [Convex Agent Documentation](https://docs.convex.dev/agents)
- Review examples in `agents/example.ts`
- Check the [GitHub repository](https://github.com/get-convex/agent)