# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

**IMPORTANT**: This monorepo uses Yarn v1.22.19 exclusively. Always use `yarn` commands, never `npm` or `pnpm`. The workspace configuration is optimized for Yarn workspaces.

## Commands

### Development
```bash
# Run all apps with Turborepo TUI (recommended)
yarn dev

# Run specific apps
yarn workspace @apps/web dev        # Web app on localhost:3000
yarn workspace @apps/native dev     # Expo dev server
yarn workspace @packages/backend dev # Convex backend

# Mobile app development
cd apps/native
yarn ios     # iOS simulator
yarn android # Android emulator
```

### Code Quality
```bash
# Run from root for all packages
yarn lint          # Check linting
yarn lint:fix      # Auto-fix issues
yarn typecheck     # TypeScript validation
yarn format        # Prettier formatting

# Clean builds
yarn clean
```

### Testing
```bash
# No test commands configured yet - check individual package.json files
```

### Backend AI Playground
```bash
cd packages/backend
yarn playground:apikey  # Generate API key
yarn playground:local   # Run agent testing UI
```

### Deployment
```bash
# Deploy web app with Convex backend (from apps/web)
cd ../../packages/backend && yarn convex deploy --cmd 'cd ../../apps/web && turbo run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
```

## Architecture

### Monorepo Structure
- **apps/web**: Next.js 15 with App Router, Tailwind CSS v4, Clerk auth
- **apps/native**: Expo SDK 53 with React Native New Architecture, React Navigation v7
- **packages/backend**: Convex backend with AI agent system

### AI Agent System

Located in `packages/backend/convex/agents/`, this is a sophisticated modular AI agent architecture using the Convex Agent framework.

#### Agent Factory Pattern

The `AgentFactory` class (`core/factory.ts`) provides centralized agent creation:
- **Dynamic imports**: Agents are lazy-loaded using the registry pattern for optimal code splitting
- **Configuration merging**: Three-level config inheritance (default → agent-specific → custom)
- **Type safety**: Full TypeScript support with AgentType enum
- **Main methods**:
  - `AgentFactory.create(type, customConfig?)`: Create predefined agent types
  - `AgentFactory.createCustom(config)`: Create fully custom agents
  - `AgentFactory.getAvailableTypes()`: List all registered agent types

#### Agent Registry

The registry (`core/registry.ts`) uses dynamic imports for efficient loading:
```typescript
agentRegistry = {
  summary: () => import('../summaryAgent'),
  notes: () => import('../notesAgent'),
  // ... other agents
}
```

#### Available Agents

1. **summaryAgent**: Document/text summarization with low creativity for accuracy
2. **notesAgent** (temp 0.5): Note management with 5 built-in tools:
   - `searchNotes`: Find notes by content/title
   - `createNote`: Create new notes with optional AI summaries
   - `getNote`: Retrieve specific notes by ID
   - `deleteNote`: Remove notes
   - `analyzeNotes`: Extract insights, topics, and trends
3. **researchAgent**: Topic exploration with higher creativity
4. **analysisAgent**: Data analysis with balanced accuracy
5. **creativeAgent**: Creative writing with maximum creativity

#### Thread Management

The `withAgentThread` helper ensures all agent interactions are properly tracked:
- Creates conversation threads for history tracking
- Enables playground visibility for debugging
- Provides consistent execution pattern
- Returns structured responses with usage metrics

#### Tool System

Agents can be extended with tools using the `createTool` function:
- **Zod validation**: Input/output type safety
- **Context access**: Tools receive `ToolCtx` for database operations
- **Composable**: Tools can be mixed and matched across agents
- **Example**: The notesAgent includes 5 specialized tools for note operations

#### Usage Patterns

```typescript
// Basic usage with factory
const agent = await AgentFactory.create('summary');
const result = await agent.generateText(ctx, { threadId, userId }, { prompt });

// Custom agent with tools
const customAgent = await AgentFactory.createCustom({
  name: "Custom Assistant",
  instructions: "Your custom instructions",
  tools: noteTools
});

// Streaming responses
const stream = await agent.streamText(ctx, { threadId, userId }, { prompt }, {
  saveStreamDeltas: { chunking: "word", throttleMs: 100 }
});
```

### Database Schema (packages/backend/convex/schema.ts)
- **notes**: userId, title, content, summary (AI-generated)
- **rateLimits**: API rate limiting per user/endpoint
- **usage**: Token usage and cost tracking

### Authentication
Clerk handles auth for both web and native apps. Configure in:
- Web: `apps/web/.env.local`
- Native: `apps/native/.env.local`
- Backend: Convex dashboard environment variables

### Key Technologies
- **Turborepo**: Task orchestration with caching
- **Convex**: Real-time database with server functions
- **Clerk**: Multi-platform authentication
- **OpenAI**: AI capabilities (optional, set OPENAI_API_KEY in Convex)

### Development Workflow
1. All apps share the same Convex backend
2. Type safety flows from backend schema to frontend clients
3. Real-time data sync is automatic via Convex subscriptions
4. Hot reload works across all platforms
5. Use Turborepo TUI (`yarn dev`) to see logs for each app separately