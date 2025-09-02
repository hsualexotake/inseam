import { action, query } from "./_generated/server";
import { v } from "convex/values";
import { AgentFactory } from "./agents";
import { createThread } from "@convex-dev/agent";
import { components, api } from "./_generated/api";
import { internal } from "./_generated/api";
import type { EmailSummaryResult, FormattedEmail } from "./nylas/types";
import { getAuthenticatedUserId, getOptionalUserId } from "./nylas/auth";
import { MAX_EMAIL_SUMMARY_COUNT, validatePromptLength } from "./nylas/config";

/**
 * Main action to summarize user's inbox
 * Fetches recent emails and generates an AI summary
 */
export const summarizeInbox = action({
  args: {
    emailCount: v.optional(v.number()),
  },
  handler: async (ctx, { emailCount = 5 }): Promise<EmailSummaryResult> => {
    const userId = await getAuthenticatedUserId(ctx.auth);
    
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
    
    // Format emails for the AI prompt
    const emailsFormatted = emailData.emails.map((email: FormattedEmail, index: number) => `
Email ${index + 1}:
From: ${email.from.name || email.from.email} <${email.from.email}>
Subject: ${email.subject}
Date: ${new Date(email.date * 1000).toLocaleString()}
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
        prompt: `You are analyzing ${emailData.emails.length} recent emails. Please create a comprehensive summary.

Here are the emails:
${emailsFormatted}

Based on these emails, create a summary that includes:

## Email Summary Overview
- Total number of emails: ${emailData.emails.length}
- Time range: ${emailData.emails.length > 0 ? `${new Date(emailData.emails[emailData.emails.length - 1].date * 1000).toLocaleDateString()} to ${new Date(emailData.emails[0].date * 1000).toLocaleDateString()}` : 'N/A'}
- Unread count: ${emailData.emails.filter((e: FormattedEmail) => e.unread).length}

## Priority Items
- List any urgent or high-priority emails (look for words like "urgent", "ASAP", "deadline", "important")
- Include sender and subject for each priority item

## Action Items & Tasks
- Extract specific action items or tasks mentioned in the emails
- Include any deadlines mentioned

## Key Topics
- Group related emails by topic
- Summarize the main points

## Requires Response
- List emails that need a response or follow-up
- Note the sender and topic

Format the summary in a clear, structured way using markdown with bullet points.`,
      }
    );
    
    // Get email IDs for storage
    const emailIds = emailData.emails.map((e: FormattedEmail) => e.id);
    
    // Store the summary in database
    const now = new Date();
    await ctx.runMutation(internal.nylas.internal.storeEmailSummary, {
      userId,
      emailIds,
      summary: result.text,
      threadId,
      timeRange: {
        start: emailData.emails.length > 0 
          ? new Date(emailData.emails[emailData.emails.length - 1].date * 1000).toISOString()
          : now.toISOString(),
        end: emailData.emails.length > 0 
          ? new Date(emailData.emails[0].date * 1000).toISOString()
          : now.toISOString(),
      },
    });
    
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
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 10 }) => {
    const userId = await getOptionalUserId(ctx.auth);
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
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx.auth);
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
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx.auth);
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

/**
 * Generate an intelligent response to an email
 */
export const generateEmailResponse = action({
  args: {
    emailId: v.string(),
    responseType: v.union(
      v.literal("accept"),
      v.literal("decline"),
      v.literal("followup"),
      v.literal("custom")
    ),
    customPrompt: v.optional(v.string()),
  },
  handler: async (ctx, { emailId, responseType, customPrompt }) => {
    const userId = await getAuthenticatedUserId(ctx.auth);
    
    // Validate custom prompt if provided
    if (customPrompt) {
      validatePromptLength(customPrompt);
    }
    // Fetch emails directly using the simplified action
    const emailData = await ctx.runAction(api.nylas.actions.fetchRecentEmails, {
      limit: 20, // Fetch more to find the specific email
      offset: 0,
    });
    
    const email = emailData.emails.find((e: FormattedEmail) => e.id === emailId);
    if (!email) {
      throw new Error("Email not found");
    }
    
    // Create agent for email response generation
    const agent = await AgentFactory.create('creative');
    
    // Create thread
    const threadId = await createThread(ctx, components.agent, {
      userId,
      title: `Email Response - ${email.subject}`,
    });
    
    // Generate response based on type
    let prompt = "";
    switch (responseType) {
      case "accept":
        prompt = `Generate a professional email accepting the following request. Original email: Subject: ${email.subject}, From: ${email.from.email}, Body: ${email.body}`;
        break;
      case "decline":
        prompt = `Generate a polite email declining the following request. Original email: Subject: ${email.subject}, From: ${email.from.email}, Body: ${email.body}`;
        break;
      case "followup":
        prompt = `Generate a follow-up email for: Subject: ${email.subject}, From: ${email.from.email}, Body: ${email.body}`;
        break;
      case "custom":
        prompt = customPrompt || `Generate a response to: Subject: ${email.subject}, From: ${email.from.email}, Body: ${email.body}`;
        break;
    }
    
    const result = await agent.generateText(
      ctx,
      { threadId, userId },
      { prompt }
    );
    
    return {
      response: result.text,
      threadId,
    };
  },
});