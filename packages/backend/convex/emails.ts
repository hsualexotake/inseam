import { action, query } from "./_generated/server";
import { v } from "convex/values";
import { AgentFactory } from "./agents";
import { createThread } from "@convex-dev/agent";
import { components, api } from "./_generated/api";
import { internal } from "./_generated/api";
import type { EmailSummaryResult, FormattedEmail } from "./nylas/types";
import { requireAuth, optionalAuth } from "./helpers/auth";
import { MAX_EMAIL_SUMMARY_COUNT } from "./nylas/config";
// Auth helpers - keeping import in case needed for future endpoints

/**
 * Main action to summarize user's inbox
 * Fetches recent emails and generates an AI summary
 */
export const summarizeInbox = action({
  args: v.object({
    emailCount: v.optional(v.number()),
  }),
  handler: async (ctx, { emailCount = 5 }): Promise<EmailSummaryResult> => {
    const userId = await requireAuth(ctx);
    
    // Validate email count
    const validatedCount = Math.min(Math.max(1, emailCount), MAX_EMAIL_SUMMARY_COUNT);
    
    // Fetch emails directly using the simplified action
    const emailData = await ctx.runAction(api.nylas.actions.fetchRecentEmails, {
      limit: validatedCount,
      offset: 0,
    });
    
    if (!emailData.emails || emailData.emails.length === 0) {
      return {
        summary: "No emails found to summarize.",
        threadId: null,
        usage: null,
      };
    }
    
    // Check which emails have already been processed (batch query for performance)
    const emailIds = emailData.emails.map((e: FormattedEmail) => e.id);
    const processedChecks = await ctx.runQuery(
      internal.emails.internal.checkProcessedEmailsBatch,
      { userId, emailIds }
    );
    
    // Filter to only new emails that have never been processed
    const newEmails = emailData.emails.filter(
      (_: FormattedEmail, idx: number) => !processedChecks[idx]
    );
    
    // If no new emails, return informative message
    if (newEmails.length === 0) {
      return {
        summary: "No new emails since last check. All recent emails have already been processed.",
        threadId: null,
        usage: null,
      };
    }
    
    const newEmailIds = newEmails.map((e: FormattedEmail) => e.id);
    
    // Format emails for the AI prompt - now including email IDs for source tracking
    const emailsFormatted = newEmails.map((email: FormattedEmail, index: number) => `
Email ${index + 1}:
ID: ${email.id}
From: ${email.from.name || email.from.email} <${email.from.email}>
Subject: ${email.subject}
Date: ${new Date(email.date * 1000).toLocaleString()}
Date Timestamp: ${email.date}
Unread: ${email.unread ? 'Yes' : 'No'}
Has Attachments: ${email.hasAttachments ? 'Yes' : 'No'}
Content: ${email.body || email.snippet || '(No content)'}
---`).join('\n');
    
    // Create summary agent (without tools)
    const agent = await AgentFactory.create('summary');
    
    // Create thread for conversation tracking
    const threadId = await createThread(ctx, components.agent, {
      userId,
      title: `Email Inbox Summary - ${new Date().toLocaleDateString()}`,
    });
    
    // Generate summary with emails in the prompt
    const result = await agent.generateText(
      ctx,
      { threadId, userId },
      { 
        prompt: `You are analyzing ${newEmails.length} recent emails. Please create a comprehensive summary with source citations.

IMPORTANT: For each update and action item, you MUST include:
- The exact email ID it came from
- The original subject line
- A direct quote from the email (copy the exact text, do not paraphrase)
- The timestamp

Here are the emails (note the ID field for each email):
${emailsFormatted}

Create a JSON summary following the exact structure defined in your instructions. Remember to:
1. Include sourceEmailId, sourceSubject, sourceQuote, and sourceDate for EVERY update
2. Copy exact text for sourceQuote - do not paraphrase
3. For actionsNeeded, use the object format with action, sourceEmailId, sourceSubject, and sourceQuote fields
4. Extract ALL SKU changes with process type, field, and values
5. Set confidence scores based on how explicit the change is mentioned`,
      }
    );
    
    // Store the summary in database
    const now = new Date();
    await ctx.runMutation(internal.nylas.internal.storeEmailSummary, {
      userId,
      emailIds: newEmailIds,
      summary: result.text,
      threadId,
      timeRange: {
        start: newEmails.length > 0 
          ? new Date(newEmails[newEmails.length - 1].date * 1000).toISOString()
          : now.toISOString(),
        end: newEmails.length > 0 
          ? new Date(newEmails[0].date * 1000).toISOString()
          : now.toISOString(),
      },
    });
    
    // Process the summary and create unified updates
    try {
      // Store updates in the unified updates table
      const updateResult = await ctx.runMutation(api.updates.processEmailSummary, {
        emailIds: newEmailIds,
        summary: result.text,
      });
      
      // Only mark emails as processed if at least some updates succeeded
      if (updateResult.success) {
        await ctx.runMutation(internal.emails.internal.markEmailsProcessed, {
          userId,
          emailIds: newEmailIds,
        });
        
        // Log partial failures if any
        if (updateResult.failed > 0) {
          // eslint-disable-next-line no-console
          console.warn(`Processed ${updateResult.created} updates successfully, ${updateResult.failed} failed`);
        }
      } else {
        // No updates succeeded, throw error to prevent marking as processed
        throw new Error(`Failed to process any updates from email summary`);
      }
    } catch (error) {
      // Re-throw to prevent marking emails as processed
      throw new Error(`Failed to process email summary: ${error}`);
    }
    
    return {
      summary: result.text,
      threadId,
      usage: result.usage ? {
        promptTokens: 0, // Agent framework doesn't provide token breakdown
        completionTokens: 0,
        totalTokens: result.usage.totalTokens || 0,
      } : null,
    };
  },
});

/**
 * Get user's email summaries history
 */
export const getEmailSummaries = query({
  args: v.object({
    limit: v.optional(v.number()),
  }),
  handler: async (ctx, { limit = 10 }) => {
    const userId = await optionalAuth(ctx);
    if (!userId) {
      return [];
    }
    
    // Fetch summaries from database
    const summaries = await ctx.db
      .query("emailSummaries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    
    return summaries;
  },
});

/**
 * Check if user has connected their email
 */
export const hasConnectedEmail = query({
  args: v.object({}),
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) {
      return false;
    }
    
    // Check if user has a Nylas grant
    const grant = await ctx.db
      .query("nylasGrants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    return {
      isConnected: !!grant,
      email: grant?.email,
      provider: grant?.provider,
    };
  },
});

/**
 * Get email connection details for the current user
 */
export const getEmailConnection = query({
  args: v.object({}),
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) {
      return null;
    }
    
    // Get user's Nylas grant
    const grant = await ctx.db
      .query("nylasGrants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (!grant) {
      return null;
    }
    
    return {
      email: grant.email,
      provider: grant.provider,
      connectedAt: new Date(grant.createdAt).toISOString(),
      lastUpdated: new Date(grant.updatedAt).toISOString(),
    };
  },
});