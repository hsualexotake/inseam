import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { api } from "./_generated/api";
import { optionalAuth, requireAuth } from "./helpers/auth";
import { ERROR_MESSAGES } from "./constants";

/**
 * Unified Updates System
 * Central hub for all update sources (email, wechat, whatsapp, etc)
 */

// Get paginated updates with view mode (active or archived)
export const getUpdates = query({
  args: {
    paginationOpts: paginationOptsValidator,
    viewMode: v.union(v.literal("active"), v.literal("archived")),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await optionalAuth(ctx);
    if (!userId) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }
    
    let query = ctx.db
      .query("updates")
      .withIndex("by_user_created", (q) => q.eq("userId", userId));
    
    // Filter by view mode
    if (args.viewMode === "active") {
      // Show items that haven't been archived yet
      query = query.filter((q) => 
        q.eq(q.field("archivedAt"), undefined)
      );
    } else {
      // Show archived items
      query = query.filter((q) => 
        q.neq(q.field("archivedAt"), undefined)
      );
    }
    
    // Filter by source if provided
    if (args.source && args.source !== "all") {
      query = query.filter((q) => q.eq(q.field("source"), args.source));
    }
    
    return await query.order("desc").paginate(args.paginationOpts);
  },
});

// Process email summary and create multiple updates with validation
export const processEmailSummary = mutation({
  args: v.object({
    emailIds: v.array(v.string()),
    summary: v.string(),
  }),
  handler: async (ctx, { emailIds, summary }) => {
    const userId = await requireAuth(ctx);
    
    // Validate inputs
    if (emailIds.length === 0) {
      throw new Error("At least one email ID is required");
    }
    
    if (emailIds.length > 50) {
      throw new Error("Too many email IDs. Maximum 50 allowed.");
    }
    const now = Date.now();
    
    try {
      const summaryData = JSON.parse(summary);
      const createdUpdates = [];
      const failedUpdates = [];
      
      // Process each update in the summary
      if (summaryData.updates && Array.isArray(summaryData.updates)) {
        for (const update of summaryData.updates) {
          // Extract SKU changes from this specific update
          const relatedSkuChanges = summaryData.skuChanges?.filter((sku: { skuCode: string; sourceQuote?: string }) => 
            update.sourceQuote?.includes(sku.skuCode) ||
            update.summary?.includes(sku.skuCode)
          );
          
          // Validate required fields before insert
          if (!update.summary) {
            continue; // Skip this update but continue processing others
          }
          
          try {
            const updateId = await ctx.db.insert("updates", {
              userId,
              source: "email",
              sourceId: update.sourceEmailId || emailIds[0],
              type: update.type || "general",
              category: update.category || (update.type === "general" ? "general" : "fashion_ops"),
              title: update.summary.substring(0, 50),
              summary: update.summary,
              urgency: update.urgency || "medium",
              fromName: update.from || "Unknown", // Provide default value
              sourceSubject: update.sourceSubject,
              sourceQuote: update.sourceQuote,
              sourceDate: update.sourceDate,
              skuUpdates: relatedSkuChanges?.map((sku: { 
                skuCode: string; 
                field: string; 
                currentValue?: string | null; // Accept both string and null from AI
                newValue: string; 
                confidence?: number;
              }) => ({
                skuCode: sku.skuCode,
                field: sku.field,
                oldValue: sku.currentValue,
                newValue: sku.newValue,
                confidence: sku.confidence || 0.8,
              })),
              actionsNeeded: [],
              createdAt: now,
              processed: false,
            });
            
            createdUpdates.push(updateId);
          } catch (insertError) {
            // Log error but continue processing other updates (partial failure handling)
            // eslint-disable-next-line no-console
            console.error(`Failed to insert update: ${update.summary?.substring(0, 50)}`, insertError);
            failedUpdates.push({ update, error: insertError });
            // Continue processing other updates instead of throwing
          }
        }
      }
      
      // Process action items
      if (summaryData.actionsNeeded && Array.isArray(summaryData.actionsNeeded)) {
        for (const action of summaryData.actionsNeeded) {
          try {
            const actionText = typeof action === 'string' ? action : action.action;
            const sourceQuote = typeof action === 'object' ? action.sourceQuote : undefined;
            
            const updateId = await ctx.db.insert("updates", {
              userId,
              source: "email",
              sourceId: emailIds[0],
              type: "action",
              title: "⚡ Action Required",
              summary: actionText,
              urgency: "high",
              sourceQuote,
              actionsNeeded: [{
                action: actionText,
                completed: false,
                completedAt: undefined,
              }],
              createdAt: now,
              processed: false,
            });
            
            createdUpdates.push(updateId);
          } catch (insertError) {
            // Log but continue with other actions
            // eslint-disable-next-line no-console
            console.error(`Failed to insert action item: ${action}`, insertError);
            failedUpdates.push({ action, error: insertError });
          }
        }
      }
      
      // NOTE: SKU updates are now stored but NOT auto-processed
      // They require manual approval via approveSKUUpdates mutation
      // This ensures users can review changes before they're applied
      
      // Don't mark as processed - they're pending approval
      // for (const id of createdUpdates) {
      //   await ctx.db.patch(id, { processed: false });
      // }
      
      // Report results including partial failures
      if (failedUpdates.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(`Processed ${createdUpdates.length} updates successfully, ${failedUpdates.length} failed`);
      }
      
      return { 
        created: createdUpdates.length,
        failed: failedUpdates.length,
        success: createdUpdates.length > 0 
      };
    } catch (error) {
      // Log error but don't fail the entire operation
      // eslint-disable-next-line no-console
      console.error("Failed to process email summary:", error);
      return { created: 0, failed: 0, success: false };
    }
  },
});

// Mark action as completed with validation
export const completeAction = mutation({
  args: v.object({
    updateId: v.id("updates"),
    actionIndex: v.number(),
  }),
  handler: async (ctx, { updateId, actionIndex }) => {
    await requireAuth(ctx);
    
    const update = await ctx.db.get(updateId);
    if (!update) throw new Error("Update not found");
    
    const actions = update.actionsNeeded || [];
    if (actionIndex < 0 || actionIndex >= actions.length) {
      throw new Error("Invalid action index");
    }
    
    actions[actionIndex].completed = true;
    actions[actionIndex].completedAt = Date.now();
    
    await ctx.db.patch(updateId, { actionsNeeded: actions });
    
    return { success: true };
  },
});

// Acknowledge/dismiss an update with validation
export const acknowledgeUpdate = mutation({
  args: v.object({
    updateId: v.id("updates"),
  }),
  handler: async (ctx, { updateId }) => {
    const userId = await requireAuth(ctx);
    
    const update = await ctx.db.get(updateId);
    if (!update) throw new Error("Update not found");
    
    // Verify the update belongs to the user
    if (update.userId !== userId) {
      throw new Error("Unauthorized");
    }
    
    // Mark as acknowledged
    const now = Date.now();
    await ctx.db.patch(updateId, { 
      acknowledged: true,
      acknowledgedAt: now,
      archivedAt: now, // Archive when dismissed
    });
    
    return { success: true };
  },
});

// Approve SKU updates and apply them to tracking
export const approveSKUUpdates = mutation({
  args: v.object({
    updateId: v.id("updates"),
  }),
  handler: async (ctx, { updateId }) => {
    const userId = await requireAuth(ctx);
    
    // Fetch and validate in single step for atomicity
    const update = await ctx.db.get(updateId);
    if (!update) throw new Error(ERROR_MESSAGES.UPDATE_NOT_FOUND);
    if (update.userId !== userId) throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    
    // Check current state atomically
    if (update.processed || update.skuUpdatesApproved) {
      throw new Error(ERROR_MESSAGES.ALREADY_APPROVED);
    }
    
    if (update.skuUpdatesRejected) {
      throw new Error(ERROR_MESSAGES.ALREADY_REJECTED);
    }
    
    // Apply the SKU changes if they exist
    if (update.skuUpdates && update.skuUpdates.length > 0) {
      // Mark as processing first to prevent double-processing
      const now = Date.now();
      await ctx.db.patch(updateId, {
        processed: true,
        skuUpdatesApproved: true,
        skuUpdatesApprovedAt: now,
        skuUpdatesApprovedBy: userId,
        archivedAt: now, // Archive when approved
      });
      
      // Then apply the changes
      await ctx.runMutation(api.tracking.processSKUUpdatesFromEmail, {
        emailId: update.sourceId || "",
        skuUpdates: update.skuUpdates.map(sku => ({
          skuCode: sku.skuCode,
          productName: undefined, // Not stored in the updates table
          field: sku.field,
          newValue: sku.newValue,
          sourceQuote: update.sourceQuote || "",
          confidence: sku.confidence,
        })),
      });
      
      return { success: true, message: "SKU updates approved and applied" };
    }
    
    return { success: false, message: ERROR_MESSAGES.NO_SKU_UPDATES };
  },
});

// Reject SKU updates without applying them
export const rejectSKUUpdates = mutation({
  args: v.object({
    updateId: v.id("updates"),
  }),
  handler: async (ctx, { updateId }) => {
    const userId = await requireAuth(ctx);
    
    // Fetch and validate in single step for atomicity
    const update = await ctx.db.get(updateId);
    if (!update) throw new Error(ERROR_MESSAGES.UPDATE_NOT_FOUND);
    if (update.userId !== userId) throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    
    // Check current state atomically
    if (update.processed || update.skuUpdatesApproved) {
      throw new Error(ERROR_MESSAGES.ALREADY_APPROVED);
    }
    
    if (update.skuUpdatesRejected) {
      throw new Error(ERROR_MESSAGES.ALREADY_REJECTED);
    }
    
    // Mark as rejected without processing
    const now = Date.now();
    await ctx.db.patch(updateId, {
      skuUpdatesRejected: true,
      skuUpdatesRejectedAt: now,
      skuUpdatesRejectedBy: userId,
      archivedAt: now, // Archive when rejected
    });
    
    return { success: true, message: "SKU updates rejected" };
  },
});

// Get update statistics with validation
export const getUpdateStats = query({
  args: v.object({}),
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return null;
    
    // Use take() with limit instead of collect() to prevent memory issues
    const updates = await ctx.db
      .query("updates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1000); // Cap at 1000 for stats calculation
    
    const sourceBreakdown: Record<string, number> = {};
    const typeBreakdown: Record<string, number> = {};
    let pendingActions = 0;
    
    for (const update of updates) {
      sourceBreakdown[update.source] = (sourceBreakdown[update.source] || 0) + 1;
      typeBreakdown[update.type] = (typeBreakdown[update.type] || 0) + 1;
      
      if (update.actionsNeeded) {
        pendingActions += update.actionsNeeded.filter(a => !a.completed).length;
      }
    }
    
    return {
      total: updates.length,
      sources: sourceBreakdown,
      types: typeBreakdown,
      pendingActions,
    };
  },
});