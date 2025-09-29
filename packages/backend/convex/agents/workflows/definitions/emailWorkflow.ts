/**
 * Email Processing Workflow (Optimized)
 *
 * Batch workflow for processing multiple emails with tracker integration
 * Uses single LLM call per email and parallel processing for 5x speed improvement
 *
 * Steps:
 * 1. Combined analyze and extract (single LLM call per email)
 * 2. Create tracker proposals from extracted data
 * 3. Store centralized updates in the database
 */

import { v } from "convex/values";
import { internal } from "../../../_generated/api";
import { workflow } from "../manager";

/**
 * OPTIMIZED Batch email processing workflow
 * Uses single LLM call per email and reuses agent instance
 */
export const batchEmailWorkflowOptimized = workflow.define({
  args: {
    emails: v.array(v.object({
      id: v.string(),
      subject: v.string(),
      from: v.object({
        name: v.optional(v.string()),
        email: v.string(),
      }),
      date: v.number(),
      body: v.optional(v.string()),
      snippet: v.optional(v.string()),
    })),
    trackers: v.array(v.object({
      id: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      color: v.optional(v.string()),
      primaryKeyColumn: v.string(),
      columns: v.array(v.object({
        id: v.string(),
        name: v.string(),
        key: v.string(),
        type: v.string(),
        required: v.boolean(),
        options: v.optional(v.array(v.string())),
        aiEnabled: v.optional(v.boolean()),
        aiAliases: v.optional(v.array(v.string())),
        description: v.optional(v.string()),
        color: v.optional(v.string()),
      })),
    })),
    userId: v.string(),
  },
  handler: async (step, { emails, trackers, userId }): Promise<any> => {
    // Create a shared thread for the entire batch (saves 100-300ms per email)
    const { threadId: batchThreadId } = await step.runAction(
      internal.agents.workflows.actions.emailActions.createBatchThread,
      {
        userId,
        title: `Batch Email Processing - ${emails.length} emails`,
      }
    );

    // Process all emails in parallel for 5x speed improvement
    const emailProcessingPromises = emails.map(async (email) => {
      try {
        // Step 1: Combined analyze and extract (single LLM call)
        const optimizedResult = await step.runAction(
          internal.agents.workflows.actions.emailActions.analyzeAndExtractEmailOptimized,
          {
            email,
            trackers,
            userId,
            threadId: batchThreadId, // Reuse shared thread instead of creating new one
          }
        );

        const trackerMatches = optimizedResult.trackerMatches || [];
        const extractedData = optimizedResult.extractedData || {};

        // Step 2: Create proposals (no LLM needed, just formatting)
        const proposalResult = await step.runAction(
          internal.agents.workflows.actions.emailActions.createTrackerProposals,
          {
            trackerMatches,
            extractedData,
            trackers,
            email,
          }
        );

        // Step 3: Store update
        const storeResult = await step.runAction(
          internal.agents.workflows.actions.emailActions.storeCentralizedUpdate,
          {
            emailId: email.id,
            emailSummary: proposalResult.emailSummary,
            trackerMatches: proposalResult.trackerMatches,
            trackerProposals: proposalResult.trackerProposals,
            email: {
              from: email.from,
              subject: email.subject,
              date: email.date,
              snippet: email.snippet,
              body: email.body,
            },
            userId,
          }
        );

        // Return success result with all needed data
        return {
          success: storeResult.success,
          emailId: email.id,
          updateId: storeResult.updateId,
          proposalCount: proposalResult.trackerProposals.length,
          trackerCount: proposalResult.trackerMatches.length,
          threadId: optimizedResult.threadId,
          error: storeResult.success ? undefined : storeResult.error,
        };
      } catch (error) {
        // Error isolation - one email failure doesn't affect others
        return {
          success: false,
          emailId: email.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Execute all email processing in parallel (Convex best practice)
    const processedResults = await Promise.all(emailProcessingPromises);

    // Aggregate results after parallel processing
    const results = [];
    const failedEmails = [];
    let successCount = 0;
    let totalProposals = 0;
    let threadId: string | undefined;

    for (const result of processedResults) {
      if (result.success) {
        successCount++;
        if (result.proposalCount) totalProposals += result.proposalCount;
        if (!threadId && result.threadId) threadId = result.threadId;
        results.push({
          emailId: result.emailId,
          updateId: result.updateId,
          proposalCount: result.proposalCount || 0,
          trackerCount: result.trackerCount || 0,
        });
      } else {
        failedEmails.push({
          emailId: result.emailId,
          error: result.error || 'Failed to process email',
        });
      }
    }

    // Return batch results
    return {
      status: 'completed',
      threadId,
      statistics: {
        totalEmails: emails.length,
        successfulUpdates: successCount,
        failedProcessing: failedEmails.length,
        totalProposals,
        averageProposalsPerEmail: successCount > 0 ? totalProposals / successCount : 0,
      },
      results,
      failedEmails,
    };
  },
});