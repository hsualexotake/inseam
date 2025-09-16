/**
 * onComplete handlers for email workflows
 * These handlers process workflow results after completion
 */

import { v } from "convex/values";
import { internalMutation } from "../../../_generated/server";
import { vWorkflowId } from "@convex-dev/workflow";
import { internal } from "../../../_generated/api";

/**
 * Handle batch email workflow completion
 * Processes the results and marks emails as processed
 */
export const handleBatchEmailComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    context: v.object({
      userId: v.string(),
      emailIds: v.array(v.string()),
    }),
    result: v.union(
      v.object({
        kind: v.literal("success"),
        returnValue: v.any(),
      }),
      v.object({
        kind: v.literal("failed"),
        error: v.string(),
      }),
      v.object({
        kind: v.literal("canceled"),
      })
    ),
  },
  handler: async (ctx, { workflowId, context, result }) => {
    console.log(`Workflow ${workflowId} completed with status: ${result.kind}`);
    
    if (result.kind === "success" && result.returnValue) {
      const workflowResult = result.returnValue;
      
      // Mark successfully processed emails
      if (workflowResult.results && workflowResult.results.length > 0) {
        const successfulEmailIds = workflowResult.results.map((r: any) => r.emailId);
        await ctx.runMutation(internal.emails.internal.markEmailsProcessed, {
          userId: context.userId,
          emailIds: successfulEmailIds,
        });
        
        console.log(`Marked ${successfulEmailIds.length} emails as processed`);
      }
      
      // Log statistics
      if (workflowResult.statistics) {
        console.log("Workflow statistics:", workflowResult.statistics);
      }
      
      // Store workflow completion status if needed
      // You could store this in a table for UI display
      
    } else if (result.kind === "failed") {
      console.error(`Workflow failed: ${result.error}`);
      
      // Optionally mark emails as failed or retry
      // For now, we'll just log the error
      
    } else if (result.kind === "canceled") {
      console.log("Workflow was canceled");
    }
  },
});

/**
 * Handle single email workflow completion
 */
export const handleEmailAnalysisComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    context: v.object({
      userId: v.string(),
      emailId: v.string(),
    }),
    result: v.union(
      v.object({
        kind: v.literal("success"),
        returnValue: v.any(),
      }),
      v.object({
        kind: v.literal("failed"),
        error: v.string(),
      }),
      v.object({
        kind: v.literal("canceled"),
      })
    ),
  },
  handler: async (ctx, { workflowId, context, result }) => {
    console.log(`Email analysis workflow ${workflowId} completed with status: ${result.kind}`);
    
    if (result.kind === "success" && result.returnValue) {
      // Mark email as processed
      await ctx.runMutation(internal.emails.internal.markEmailsProcessed, {
        userId: context.userId,
        emailIds: [context.emailId],
      });
      
      console.log(`Email ${context.emailId} processed successfully`);
      
    } else if (result.kind === "failed") {
      console.error(`Email analysis failed for ${context.emailId}: ${result.error}`);
    }
  },
});