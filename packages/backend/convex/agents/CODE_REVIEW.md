# AI Agent System - Production Code Review

## Executive Summary
The codebase is well-structured with good separation of concerns. However, there are several critical issues that need to be addressed before production deployment.

## 🔴 Critical Issues (Must Fix)

### 1. **API Key Exposure in Query** 
**File**: `convex/notes.ts:11-16`
```typescript
// SECURITY ISSUE: API key exposed to client
export const aiModelsConfigured = query({
  handler: async () => {
    return !!process.env.OPENAI_API_KEY; // ❌ Environment variables exposed
  },
});
```
**Risk**: Environment variables are server-side only, but queries can be called from client
**Fix**: Move this check to an internal mutation or action
```typescript
// ✅ Better approach
export const aiModelsConfigured = internalQuery({
  handler: async () => {
    return !!process.env.OPENAI_API_KEY;
  },
});
```

### 2. **Missing Authorization Checks**
**File**: `convex/notes.ts:73-80`
```typescript
export const deleteNote = mutation({
  handler: async (ctx, args) => {
    await ctx.db.delete(args.noteId); // ❌ No ownership verification
  },
});
```
**Risk**: Any user can delete any note
**Fix**: Add ownership verification
```typescript
export const deleteNote = mutation({
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found or unauthorized");
    }
    
    await ctx.db.delete(args.noteId);
  },
});
```

## 🟡 High Priority Issues

### 3. **Insufficient Error Messages**
**File**: `convex/ai/models.ts`
```typescript
if (!chat) {
  throw new Error("AI model configuration required. Please check your environment settings.");
}
```
**Issue**: Generic error doesn't help with debugging
**Fix**: Provide actionable error messages
```typescript
if (!chat) {
  throw new Error(
    "OpenAI API key not configured. Set OPENAI_API_KEY environment variable in Convex dashboard."
  );
}
```

### 4. **No Rate Limiting**
**Risk**: Unbounded AI API calls could lead to high costs
**Fix**: Implement rate limiting
```typescript
// Add to core/config.ts
export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerDay: number;
}

// Track usage in a Convex table
const userUsage = await ctx.db
  .query("usage")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .first();

if (userUsage && userUsage.requestsThisMinute > MAX_REQUESTS) {
  throw new Error("Rate limit exceeded. Please try again later.");
}
```

### 5. **No Input Validation/Sanitization**
**File**: `convex/notes.ts`
```typescript
export const createNote = mutation({
  args: {
    title: v.string(),      // ❌ No length limits
    content: v.string(),    // ❌ No size limits
    isSummary: v.boolean(),
  },
```
**Fix**: Add validation
```typescript
export const createNote = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    isSummary: v.boolean(),
  },
  handler: async (ctx, { title, content, isSummary }) => {
    // Validate inputs
    if (title.length > 200) {
      throw new Error("Title must be less than 200 characters");
    }
    if (content.length > 50000) {
      throw new Error("Content must be less than 50KB");
    }
    if (title.trim().length === 0) {
      throw new Error("Title cannot be empty");
    }
    // ... rest of handler
  }
});
```

## 🟢 Medium Priority Issues

### 6. **Type Safety Issues**
**File**: `convex/agents/notesAgent/tools.ts`
```typescript
.filter((note: any) =>  // ❌ Using 'any' type
  note.title.toLowerCase().includes(query.toLowerCase())
)
```
**Fix**: Define proper types
```typescript
interface Note {
  _id: string;
  title: string;
  content: string;
  summary?: string;
  userId: string;
}

.filter((note: Note) =>
  note.title.toLowerCase().includes(query.toLowerCase())
)
```

### 7. **No Retry Logic for Agent Failures**
**File**: `convex/notes.ts:90-139`
```typescript
} catch (error) {
  console.error("Error generating summary:", error);
  // ❌ No retry logic
}
```
**Fix**: Add exponential backoff retry
```typescript
const MAX_RETRIES = 3;
let retries = 0;
let lastError;

while (retries < MAX_RETRIES) {
  try {
    const result = await summaryAgent.generateText(...);
    return result;
  } catch (error) {
    lastError = error;
    retries++;
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
  }
}
throw lastError;
```

### 8. **Logging Sensitive Data**
**File**: `convex/agents/core/config.ts:44-51`
```typescript
console.log(`[Agent Usage] ${agentName}:`, {
  userId,  // ⚠️ PII logged
  tokens: usage.totalTokens,
});
```
**Fix**: Hash or redact PII
```typescript
console.log(`[Agent Usage] ${agentName}:`, {
  userHash: hashUserId(userId), // Hash for privacy
  tokens: usage.totalTokens,
});
```

## 🔵 Best Practice Improvements

### 9. **Add Cost Tracking**
```typescript
// Track costs per user
const COST_PER_1K_TOKENS = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
};

usageHandler: async (ctx, args) => {
  const cost = calculateCost(args.usage, args.model);
  await ctx.runMutation(internal.usage.trackCost, {
    userId: args.userId,
    cost,
    timestamp: Date.now(),
  });
}
```

### 10. **Add Monitoring and Alerting**
```typescript
// Add to usageHandler
if (usage.totalTokens > 10000) {
  await notifyAdmin("High token usage detected", {
    userId,
    tokens: usage.totalTokens,
    agentName,
  });
}
```

### 11. **Content Moderation**
```typescript
// Before processing with AI
const moderationResult = await openai.moderations.create({
  input: content,
});

if (moderationResult.results[0].flagged) {
  throw new Error("Content violates usage policies");
}
```

## 📋 Production Checklist

### Security
- [ ] Fix API key exposure in query
- [ ] Add authorization checks to all mutations
- [ ] Implement rate limiting
- [ ] Add input validation and sanitization
- [ ] Remove or hash PII from logs

### Reliability
- [ ] Add retry logic with exponential backoff
- [ ] Implement circuit breaker for external APIs
- [ ] Add health checks for OpenAI API
- [ ] Set up fallback behavior when AI unavailable

### Performance
- [ ] Implement caching for repeated queries
- [ ] Add request deduplication
- [ ] Consider using streaming for large responses
- [ ] Optimize token usage (shorter prompts)

### Monitoring
- [ ] Set up cost tracking and alerts
- [ ] Monitor error rates
- [ ] Track response times
- [ ] Log usage patterns

### Compliance
- [ ] Add content moderation
- [ ] Implement data retention policies
- [ ] Add user consent for AI processing
- [ ] Document data handling procedures

## Recommended Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Recommended for production
OPENAI_ORG_ID=org-...
MAX_TOKENS_PER_REQUEST=2000
MAX_REQUESTS_PER_MINUTE=10
MAX_DAILY_COST_USD=100
ENABLE_CONTENT_MODERATION=true
LOG_LEVEL=info
```

## Summary

**Current State**: The codebase has good architecture but needs security and production hardening.

**Priority Actions**:
1. Fix the API key exposure immediately
2. Add authorization checks to mutations
3. Implement rate limiting
4. Add input validation
5. Set up monitoring and alerting

**Estimated Time**: 2-3 days to address all critical and high-priority issues.

The system shows good design patterns with the factory pattern and modular architecture. With these security and production improvements, it will be ready for deployment.