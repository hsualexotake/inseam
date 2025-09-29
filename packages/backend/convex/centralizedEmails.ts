import { action, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { workflow } from "./agents/workflows/manager";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import type { FormattedEmail } from "./nylas/types";
import { requireAuth } from "./helpers/auth";
import { MAX_EMAIL_SUMMARY_COUNT } from "./nylas/config";
import type { WorkflowId } from "@convex-dev/workflow";

/**
 * Centralized email processing with tracker awareness
 * Uses workflow-based approach for reliable multi-step execution
 * Creates centralized updates with tracker integration
 * Email deduplication prevents processing the same emails twice
 */
export const summarizeCentralizedInbox = action({
  args: v.object({
    emailCount: v.optional(v.number()),
  }),
  handler: async (ctx, { emailCount = 5 }): Promise<{
    success: boolean;
    message: string;
    workflowId?: WorkflowId;
    status?: string;
    updatesCreated: number;
    failedEmails?: number;
    statistics?: {
      totalEmails: number;
      workflowStatus: string;
    };
  }> => {
    const userId = await requireAuth(ctx);

    // Email deduplication below prevents processing the same emails twice
    // Users can still trigger re-processing to check for new emails

    // Validate email count
    const validatedCount = Math.min(Math.max(1, emailCount), MAX_EMAIL_SUMMARY_COUNT);

    // Fetch emails using existing Nylas integration
    const emailData: { emails: FormattedEmail[] } = await ctx.runAction(api.nylas.actions.fetchRecentEmails, {
      limit: validatedCount,
      offset: 0,
    });

    if (!emailData.emails || emailData.emails.length === 0) {
      return {
        success: false,
        message: "No emails found to process",
        updatesCreated: 0,
      };
    }

    // Get processed checks and trackers in a single query (Convex best practice)
    const emailIds = emailData.emails.map((e: FormattedEmail) => e.id);
    const { processedChecks, trackers } = await ctx.runQuery(
      internal.centralizedEmails.fetchEmailWorkflowData,
      { userId, emailIds }
    );

    // Filter to only new emails
    const newEmails: FormattedEmail[] = emailData.emails.filter(
      (_: FormattedEmail, idx: number) => !processedChecks[idx]
    );

    if (newEmails.length === 0) {
      return {
        success: true,
        message: "No new emails since last check",
        updatesCreated: 0,
      };
    }

    // Prepare tracker context for the workflow
    const trackerContext = trackers.map((t: any) => ({
      id: t._id,
      name: t.name,
      description: t.description || '',
      color: t.color,
      primaryKeyColumn: t.primaryKeyColumn,
      columns: t.columns.map((col: any) => ({
        id: col.id,
        name: col.name,
        key: col.key,
        type: col.type,
        required: col.required,
        options: col.options,
        aiEnabled: col.aiEnabled || false,
        aiAliases: col.aiAliases || [],
        color: col.color,
        description: col.description,
      })),
    }));

    // Format emails for workflow
    const emailsForWorkflow = newEmails.map((email: FormattedEmail) => ({
      id: email.id,
      subject: email.subject,
      from: {
        name: email.from.name || undefined,
        email: email.from.email,
      },
      date: email.date,
      body: email.body || undefined,
      snippet: email.snippet || undefined,
    }));

    // Start the OPTIMIZED batch email workflow with onComplete handler
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.agents.workflows.definitions.emailWorkflow.batchEmailWorkflowOptimized,
      {
        emails: emailsForWorkflow,
        trackers: trackerContext,
        userId,
      },
      {
        onComplete: internal.agents.workflows.handlers.emailHandlers.handleBatchEmailComplete,
        context: {
          userId,
          emailIds,
        },
      }
    );

    // Get workflow status to return immediately
    const status = await workflow.status(ctx, workflowId);

    // Return workflow started status
    // The onComplete handler will process results and mark emails when done
    return {
      success: true,
      message: `Started workflow to process ${newEmails.length} email(s)`,
      workflowId,
      status: status.type,
      updatesCreated: 0, // Will be updated in onComplete handler
      failedEmails: 0,
      statistics: {
        totalEmails: newEmails.length,
        workflowStatus: status.type,
      },
    };
  },
});

/**
 * Get the status of a running workflow
 * Returns the current status and any available results
 */
export const getWorkflowStatus = query({
  args: v.object({
    workflowId: v.string(),
  }),
  handler: async (ctx, { workflowId }) => {
    await requireAuth(ctx);

    try {
      // Get the workflow status
      const status = await workflow.status(ctx, workflowId as WorkflowId);

      // Parse the status to determine progress
      let currentStep = "fetching";
      let stepsCompleted = 0;

      if (status.type === "inProgress") {
        // Estimate progress based on running steps
        const runningCount = status.running?.length || 0;

        // Basic heuristic: estimate progress based on number of running/completed steps
        if (runningCount > 0) {
          // Assume we're past fetching if workflow is running
          currentStep = "analyzing";
          stepsCompleted = 1;
        }

        // If multiple steps are running or have run, we're further along
        if (runningCount > 2) {
          currentStep = "matching";
          stepsCompleted = 2;
        }

        if (runningCount > 4) {
          currentStep = "creating";
          stepsCompleted = 3;
        }
      } else if (status.type === "completed") {
        currentStep = "completed";
        stepsCompleted = 4;
      } else if (status.type === "failed" || status.type === "canceled") {
        currentStep = "failed";
      }

      return {
        status: status.type,
        currentStep,
        stepsCompleted,
        runningSteps: status.type === "inProgress" ? status.running?.length : 0,
      };
    } catch (error) {
      console.error("Failed to get workflow status:", error);
      return {
        status: "unknown",
        currentStep: "unknown",
        stepsCompleted: 0,
        runningSteps: 0,
      };
    }
  },
});

/**
 * WORKFLOW PREP: Fetch all data needed for email processing workflow
 * Combines multiple queries for performance:
 * 1. Check which emails are already processed (deduplication)
 * 2. Fetch all active trackers with their schemas
 *
 * Used to prepare data before starting the email workflow.
 * Following Convex best practice: minimize ctx.runQuery calls in actions
 *
 * NOTE: Duplicates deduplication logic from emails/internal.ts/checkIfEmailsAlreadyProcessed
 * because internalQuery can't call another internalQuery via ctx.runQuery (Convex limitation)
 */
export const fetchEmailWorkflowData = internalQuery({
  args: {
    userId: v.string(),
    emailIds: v.array(v.string()),
  },
  handler: async (ctx, { userId, emailIds }) => {
    // Step 1: Check which emails have already been processed (deduplication)
    // Using same logic as checkIfEmailsAlreadyProcessed but inline since we can't call runQuery from internalQuery
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);

    const processed = await ctx.db
      .query("processedEmailIds")
      .withIndex("by_user_email", q => q.eq("userId", userId))
      .filter(q => q.gte(q.field("createdAt"), ninetyDaysAgo))
      .take(10000);

    const processedSet = new Set(processed.map(p => p.emailId));
    const processedChecks = emailIds.map(id => processedSet.has(id));

    // Step 2: Get user's active trackers with full schema for workflow context
    const trackers = await ctx.db
      .query("trackers")
      .withIndex("by_user_active", q =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .collect();

    // Transform trackers to include _id and all needed fields
    const trackersWithIds = trackers.map(t => ({
      _id: t._id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      color: t.color,
      primaryKeyColumn: t.primaryKeyColumn,
      columns: t.columns,
      isActive: t.isActive,
      folderId: t.folderId,
      userId: t.userId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return {
      processedChecks,
      trackers: trackersWithIds
    };
  }
});

