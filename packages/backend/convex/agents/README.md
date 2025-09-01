# AI Agent System Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Playground](#playground)
- [Creating New Agents](#creating-new-agents)
- [Using Agents](#using-agents)
- [Tools System](#tools-system)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

This AI Agent System provides a scalable, modular architecture for creating and managing AI agents powered by OpenAI's GPT models. Each agent is a specialized AI assistant with its own personality, tools, and configuration.

### Key Features
- 🏭 **Factory Pattern**: Consistent agent creation
- 📦 **Modular Design**: Each agent in its own directory
- 🔧 **Tool Support**: Agents can use custom tools/functions
- 🔄 **Streaming Support**: Real-time response streaming
- 💬 **Thread Memory**: Conversation history persistence
- 🎯 **Type Safety**: Full TypeScript support

## Architecture

```
convex/agents/
├── core/                    # Core infrastructure
│   ├── factory.ts          # AgentFactory - creates agents
│   ├── registry.ts         # Agent registry - maps types to modules
│   ├── config.ts           # Default configuration
│   └── types.ts            # TypeScript interfaces
│
├── summaryAgent/           # Example agent module
│   ├── index.ts           # Module export
│   ├── config.ts          # Agent configuration
│   └── tools.ts           # Agent-specific tools (optional)
│
├── notesAgent/            # Another agent with tools
│   ├── index.ts
│   ├── config.ts
│   └── tools.ts           # Note management tools
│
├── example.ts             # Usage examples
└── index.ts               # Public API exports
```

### How It Works

1. **Registry** maps agent types to their modules
2. **Factory** loads the module and creates the agent
3. **Configuration** cascades from default → agent-specific → custom
4. **Agent** is returned ready to use

## Quick Start

### Basic Usage

```typescript
import { AgentFactory, AGENT_TYPES } from './agents';

// Create an agent
const summaryAgent = await AgentFactory.create(AGENT_TYPES.SUMMARY);

// Use the agent
const result = await summaryAgent.generateText(
  ctx,
  { userId: "user123" },
  { prompt: "Summarize this article..." }
);
```

### Available Agent Types

| Agent | Purpose | Temperature | Tools |
|-------|---------|------------|-------|
| `summary` | Create concise summaries | 0.3 | None |
| `notes` | Manage user notes | 0.5 | CRUD operations |
| `research` | Research and explore topics | 0.7 | None |
| `analysis` | Analyze data and patterns | 0.4 | None |
| `creative` | Creative writing and ideation | 0.8 | None |

## Playground

### Interactive Agent Testing & Debugging

The Playground provides a comprehensive UI for testing, debugging, and developing with your agents. It allows you to inspect threads, messages, tool calls, and experiment with different prompts and settings.

### Playground Setup

#### 1. Generate an API Key

From the `packages/backend` directory:
```bash
# Using yarn (recommended for this monorepo)
yarn playground:apikey

# Or using npx directly
npx convex run --component agent apiKeys:issue '{name:"playground"}'
```

Save the generated API key - you'll need it to access the playground.

#### 2. Access the Playground

**Option A: Use the Hosted Version**
1. Visit https://get-convex.github.io/agent/
2. Enter your Convex deployment URL (found in `.env.local`)
3. Enter your API key
4. Start testing your agents!

**Option B: Run Locally**
```bash
# From packages/backend directory
yarn playground:local

# The playground will use VITE_CONVEX_URL from .env.local
```

#### 3. Available Scripts

```bash
# Show playground help/instructions
yarn playground:help

# Generate a new API key
yarn playground:apikey

# Run playground locally
yarn playground:local
```

### Playground Features

- **User & Thread Management**: Browse users and their conversation threads
- **Message Inspection**: View detailed message history with metadata
- **Tool Call Details**: Inspect when and how tools are being used
- **Context Experimentation**: Adjust context options and see results
- **Live Testing**: Send messages and see responses in real-time
- **Agent Selection**: Test all configured agents (summary, notes, research, analysis, creative)

### Security Notes

- API keys are required for secure communication
- Keys can be revoked and reissued by using the same name
- Multiple keys can be generated with different names
- Never commit API keys to version control

## Creating New Agents

### Step 1: Create Agent Directory

Create a new directory under `agents/`:
```bash
mkdir convex/agents/myNewAgent
```

### Step 2: Create Configuration

Create `myNewAgent/config.ts`:
```typescript
import type { AgentConfig } from "../core/types";

export const config: AgentConfig = {
  name: "My New Agent",
  instructions: `You are a helpful assistant that specializes in...
    
    Your key responsibilities:
    - Responsibility 1
    - Responsibility 2
    
    Guidelines:
    - Be concise and clear
    - Focus on accuracy`,
  
  // Optional: Override default settings
  config: {
    callSettings: {
      temperature: 0.5,  // 0 = focused, 1 = creative
      maxRetries: 3,
    },
  },
};
```

### Step 3: Create Tools (Optional)

If your agent needs tools, create `myNewAgent/tools.ts`:
```typescript
import { createTool } from "@convex-dev/agent";
import { z } from "zod";

export const myTool = createTool({
  description: "Description of what this tool does",
  args: z.object({
    param1: z.string().describe("What this parameter is for"),
    param2: z.number().optional().describe("Optional parameter"),
  }),
  handler: async (ctx, { param1, param2 }) => {
    // Tool implementation
    return {
      success: true,
      result: "Tool execution result",
    };
  },
});

export const myAgentTools = {
  myTool,
  // Add more tools as needed
};
```

### Step 4: Create Module Export

Create `myNewAgent/index.ts`:
```typescript
import type { AgentModule } from "../core/types";
import { config } from "./config";
import { myAgentTools } from "./tools"; // If you have tools

const myNewAgent: AgentModule = {
  config,
  tools: myAgentTools, // Or {} if no tools
};

export default myNewAgent;
```

### Step 5: Register the Agent

Update `core/registry.ts`:
```typescript
export const agentRegistry: AgentRegistry = {
  summary: () => import('../summaryAgent'),
  notes: () => import('../notesAgent'),
  myNew: () => import('../myNewAgent'), // Add your agent
  // ... other agents
};
```

### Step 6: Update Types

Update `core/types.ts`:
```typescript
export type AgentType = 'summary' | 'notes' | 'myNew' | ...;
```

Update `agents/index.ts`:
```typescript
export const AGENT_TYPES = {
  SUMMARY: 'summary' as const,
  NOTES: 'notes' as const,
  MY_NEW: 'myNew' as const, // Add constant
  // ...
};
```

### Step 7: Use Your New Agent

```typescript
const myAgent = await AgentFactory.create('myNew');
// or
const myAgent = await AgentFactory.create(AGENT_TYPES.MY_NEW);
```

## Using Agents

### Standard Agent Creation

```typescript
// Using predefined type
const agent = await AgentFactory.create('summary');

// With custom overrides
const agent = await AgentFactory.create('summary', {
  instructions: "Additional instructions...",
  config: {
    callSettings: {
      temperature: 0.2,
    },
  },
});
```

### Custom Agent Creation

```typescript
const customAgent = await AgentFactory.createCustom({
  name: "Custom Assistant",
  instructions: "You are a specialized assistant for...",
  tools: {
    searchNotes,
    createNote,
  },
});
```

### Streaming Responses

```typescript
const agent = await AgentFactory.create('summary');

const result = await agent.streamText(
  ctx,
  { threadId, userId },
  { prompt: "Analyze this..." },
  {
    saveStreamDeltas: {
      chunking: "word",      // Stream word by word
      throttleMs: 100,       // Update every 100ms
    },
  }
);

await result.consumeStream();
```

### Using with Threads (Conversation Memory)

```typescript
import { createThread } from "@convex-dev/agent";

// Create a thread for conversation history
const threadId = await createThread(ctx, components.agent, {
  userId,
  title: "Research Session",
});

// Use the thread with an agent
const agent = await AgentFactory.create('research');
const result = await agent.generateText(
  ctx,
  { threadId, userId }, // Thread maintains conversation history
  { prompt: "Continue our previous discussion..." }
);
```

## Tools System

### How Tools Work

Tools are functions that agents can call to perform actions or retrieve information.

### Creating Tools

```typescript
import { createTool } from "@convex-dev/agent";
import { z } from "zod";

export const searchDatabase = createTool({
  description: "Search the database for records",
  args: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().optional().describe("Max results (default: 10)"),
  }),
  handler: async (ctx, { query, limit = 10 }) => {
    const results = await ctx.runQuery(api.search, { query, limit });
    return {
      found: results.length,
      results,
    };
  },
});
```

### Attaching Tools to Agents

Tools can be attached in three ways:

1. **In agent module** (for agent-specific tools):
```typescript
// In myAgent/index.ts
export default {
  config,
  tools: { searchDatabase, otherTool },
};
```

2. **Via factory with custom config**:
```typescript
const agent = await AgentFactory.createCustom({
  name: "Agent with Tools",
  instructions: "...",
  tools: { searchDatabase },
});
```

3. **Override existing agent's tools**:
```typescript
const agent = await AgentFactory.create('summary', {
  tools: { customTool },
});
```

## Best Practices

### 1. Temperature Settings

- **0.0 - 0.3**: Factual, consistent (summaries, analysis)
- **0.4 - 0.6**: Balanced (general assistance)
- **0.7 - 1.0**: Creative, varied (brainstorming, writing)

### 2. Instructions Writing

```typescript
// ✅ Good: Clear, specific, structured
instructions: `You are a code reviewer specializing in TypeScript.
  
  Your approach:
  - Check for type safety issues
  - Identify potential bugs
  - Suggest performance improvements
  
  Guidelines:
  - Be constructive and specific
  - Provide code examples for fixes
  - Explain the "why" behind suggestions`

// ❌ Bad: Vague, unstructured
instructions: `You review code and find problems.`
```

### 3. Tool Design

- Keep tools focused on a single responsibility
- Provide clear descriptions for tool discovery
- Use Zod schemas for type-safe arguments
- Return consistent response structures

### 4. Error Handling

```typescript
const agent = await AgentFactory.create('summary').catch((error) => {
  console.error('Failed to create agent:', error);
  // Fallback behavior
});

const result = await agent?.generateText(ctx, opts, args).catch((error) => {
  console.error('Agent execution failed:', error);
  return { text: "I encountered an error processing your request." };
});
```

## Troubleshooting

### Common Issues

#### 1. "AI model configuration required"
**Cause**: OpenAI API key not set
**Solution**: Add `OPENAI_API_KEY` to your environment variables

#### 2. "Unknown agent type"
**Cause**: Agent type not registered
**Solution**: Check that agent is registered in `core/registry.ts`

#### 3. Tools not working
**Cause**: Tools not properly attached to agent
**Solution**: Verify tools are exported in agent module and properly defined

#### 4. TypeScript errors after adding agent
**Cause**: Types not updated
**Solution**: Update `AgentType` in `core/types.ts`

### Debug Tips

1. **Check agent configuration**:
```typescript
const agent = await AgentFactory.create('myAgent');
console.log('Agent config:', agent);
```

2. **Verify tool attachment**:
```typescript
const result = await agent.generateText(...);
console.log('Tools used:', result.toolCalls);
```

3. **Monitor token usage**:
Configure `usageHandler` in `core/config.ts` for production monitoring

## Contributing

When adding new agents:

1. Follow the existing directory structure
2. Use consistent naming (camelCase for directories)
3. Document your agent's purpose and capabilities
4. Add comprehensive examples if introducing new patterns
5. Update this README with your agent details
6. Test with both streaming and non-streaming modes
7. Ensure TypeScript compilation passes

## Environment Variables

Required:
- `OPENAI_API_KEY`: Your OpenAI API key

Optional:
- `NODE_ENV`: Set to 'development' for debug logging

## Related Documentation

- [Convex Agent Component](https://docs.convex.dev/components/agent)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Zod Schema Validation](https://zod.dev)

---

For questions or issues, check the `example.ts` file for working examples or refer to the inline documentation in each module.