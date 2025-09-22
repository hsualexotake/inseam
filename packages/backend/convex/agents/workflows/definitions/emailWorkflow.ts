/**
 * Email Processing Workflow
 * 
 * Multi-step workflow for processing emails with tracker integration
 * This workflow:
 * 1. Analyzes emails using emailHandlerAgent with tools
 * 2. Creates tracker proposals from extracted data
 * 3. Stores centralized updates in the database
 */

import { v } from "convex/values";
import { internal } from "../../../_generated/api";
import { workflow } from "../manager";

/**
 * Email analysis workflow definition
 * Processes a single email through multiple agent-powered steps
 */
export const emailAnalysisWorkflow = workflow.define({
  args: {
    email: v.object({
      id: v.string(),
      subject: v.string(),
      from: v.object({
        name: v.optional(v.string()),
        email: v.string(),
      }),
      date: v.number(),
      body: v.optional(v.string()),
      snippet: v.optional(v.string()),
    }),
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
      })),
    })),
    userId: v.string(),
    threadId: v.optional(v.string()),
  },
  handler: async (step, { email, trackers, userId, threadId }): Promise<any> => {
    // Step 1: Analyze email with agent to identify matching trackers
    const analysisResult = await step.runAction(
      internal.agents.workflows.actions.emailActions.analyzeEmailWithAgent,
      { email, trackers, userId, threadId }
    );

    // Extract tracker matches from the analysis
    const trackerMatches = analysisResult.toolResults?.trackerMatches || [];

    // Step 2: Extract data using LLM for matched trackers
    const extractionResult = await step.runAction(
      internal.agents.workflows.actions.emailActions.performLLMExtraction,
      {
        email: {
          id: email.id,
          subject: email.subject,
          body: email.body,
          snippet: email.snippet,
        },
        matchedTrackers: trackerMatches,
        trackers,
        userId,
        threadId: analysisResult.threadId,
      }
    );

    // Step 3: Create tracker proposals from extracted data
    const proposalResult = await step.runAction(
      internal.agents.workflows.actions.emailActions.createTrackerProposals,
      {
        trackerMatches,
        extractedData: extractionResult.extractedData,
        trackers,
        email,
      }
    );

    // Step 4: Store centralized update
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

    // Return complete workflow results
    return {
      status: storeResult.success ? 'completed' : 'failed',
      updateId: storeResult.updateId,
      threadId: analysisResult.threadId,
      analysis: {
        trackerMatches,
        extractionCount: extractionResult.extractionCount,
        usage: analysisResult.usage,
      },
      proposals: {
        emailSummary: proposalResult.emailSummary,
        trackerMatches: proposalResult.trackerMatches,
        trackerProposals: proposalResult.trackerProposals,
        metadata: proposalResult.metadata,
      },
      error: storeResult.error,
    };
  },
});

/**
 * Batch email processing workflow
 * Processes multiple emails in sequence
 */
export const batchEmailWorkflow = workflow.define({
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
      })),
    })),
    userId: v.string(),
  },
  handler: async (step, { emails, trackers, userId }): Promise<any> => {
    const results = [];
    const failedEmails = [];
    let successCount = 0;
    let totalProposals = 0;
    let threadId: string | undefined;
    
    // Process each email
    for (const email of emails) {
      try {
        // Step 1: Analyze email to find matching trackers
        const analysisResult = await step.runAction(
          internal.agents.workflows.actions.emailActions.analyzeEmailWithAgent,
          { email, trackers, userId, threadId }
        );

        // Set threadId from first email for continuity
        if (!threadId) {
          threadId = analysisResult.threadId;
        }

        const trackerMatches = analysisResult.toolResults?.trackerMatches || [];

        // Step 2: Extract data using LLM
        const extractionResult = await step.runAction(
          internal.agents.workflows.actions.emailActions.performLLMExtraction,
          {
            email: {
              id: email.id,
              subject: email.subject,
              body: email.body,
              snippet: email.snippet,
            },
            matchedTrackers: trackerMatches,
            trackers,
            userId,
            threadId,
          }
        );

        // Step 3: Create proposals
        const proposalResult = await step.runAction(
          internal.agents.workflows.actions.emailActions.createTrackerProposals,
          {
            trackerMatches,
            extractedData: extractionResult.extractedData,
            trackers,
            email,
          }
        );

        // Step 4: Store update
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

        if (storeResult.success) {
          successCount++;
          totalProposals += proposalResult.trackerProposals.length;
          results.push({
            emailId: email.id,
            updateId: storeResult.updateId,
            proposalCount: proposalResult.trackerProposals.length,
            trackerCount: proposalResult.trackerMatches.length,
          });
        } else {
          failedEmails.push({
            emailId: email.id,
            error: storeResult.error || 'Failed to store update',
          });
        }
      } catch (error) {
        failedEmails.push({
          emailId: email.id,
          error: error instanceof Error ? error.message : 'Unknown error',
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