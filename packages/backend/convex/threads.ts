import { mutation, query, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { 
  createThread, 
  listMessages, 
  syncStreams,
  vStreamArgs,
  type MessageDoc 
} from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { getUserId } from "./notes";

// Create a new thread for conversations
export const createNewThread = mutation({
  args: {
    title: v.optional(v.string()),
    agentType: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { title, agentType, metadata }) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const threadId = await createThread(ctx, components.agent, {
      userId,
      title: title || "New Conversation",
      metadata: {
        ...metadata,
        agentType: agentType || "general",
        createdAt: Date.now(),
      },
    });

    return threadId;
  },
});

// List all threads for the current user
export const listUserThreads = query({
  args: {
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      return { page: [], continueCursor: null, isDone: true };
    }

    const threads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      { userId, paginationOpts }
    );

    return threads;
  },
});

// Get thread metadata
export const getThreadMetadata = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Authorize thread access
    await authorizeThreadAccess(ctx, threadId, userId);

    const metadata = await ctx.runQuery(
      components.agent.threads.getThreadMetadata,
      { threadId }
    );

    return metadata;
  },
});

// List messages in a thread with streaming support
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: v.optional(paginationOptsValidator),
    streamArgs: v.optional(vStreamArgs),
    excludeToolMessages: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Authorize thread access
    await authorizeThreadAccess(ctx, args.threadId, userId);

    // Get messages
    const messages = await listMessages(ctx, components.agent, {
      ...args,
      excludeToolMessages: args.excludeToolMessages ?? true,
    });

    // Sync streams if streaming is enabled
    let streams = {};
    if (args.streamArgs) {
      streams = await syncStreams(ctx, components.agent, args);
    }

    return { ...messages, streams };
  },
});

// Update thread metadata (title, summary, etc.)
export const updateThreadMetadata = mutation({
  args: {
    threadId: v.string(),
    patch: v.object({
      title: v.optional(v.string()),
      summary: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
  },
  handler: async (ctx, { threadId, patch }) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Authorize thread access
    await authorizeThreadAccess(ctx, threadId, userId);

    await ctx.runMutation(
      components.agent.threads.updateThreadMetadata,
      { threadId, patch }
    );
  },
});

// Delete a thread and all its messages
export const deleteThread = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Authorize thread access
    await authorizeThreadAccess(ctx, threadId, userId);

    // Delete the thread asynchronously
    await ctx.scheduler.runAfter(0, internal.threads.deleteThreadAsync, { threadId });
  },
});

// Internal action to delete thread asynchronously
export const deleteThreadAsync = internalAction({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const { noteSummaryAgent } = await import("./agents/noteSummary");
    await noteSummaryAgent.deleteThreadAsync(ctx, { threadId });
  },
});

// Helper function to authorize thread access
async function authorizeThreadAccess(
  ctx: any,
  threadId: string,
  userId: string
): Promise<void> {
  const thread = await ctx.runQuery(
    components.agent.threads.getThreadMetadata,
    { threadId }
  );

  if (!thread) {
    throw new Error("Thread not found");
  }

  if (thread.userId !== userId) {
    throw new Error("Unauthorized access to thread");
  }
}

// Search messages across all user threads (for RAG)
export const searchUserMessages = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    useVectorSearch: v.optional(v.boolean()),
  },
  handler: async (ctx, { query, limit = 10, useVectorSearch = true }) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      return [];
    }

    // This is a placeholder for future RAG implementation
    // For now, return empty array
    return [] as MessageDoc[];
  },
});