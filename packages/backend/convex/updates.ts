import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { optionalAuth, requireAuth } from "./helpers/auth";
import { QUERY_LIMITS, UPDATE_TYPE_EMOJIS } from "./constants";

/**
 * Unified Updates System
 * Central hub for all update sources (email, wechat, whatsapp, etc)
 */

// Get recent updates for the current user with validation
export const getRecentUpdates = query({
  args: v.object({
    source: v.optional(v.string()), // filter by source
    limit: v.optional(v.number()),
  }),
  handler: async (ctx, { source, limit = QUERY_LIMITS.DEFAULT }) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return [];
    
    // Validate and cap limit
    const validatedLimit = Math.min(Math.max(1, limit), QUERY_LIMITS.MAX);
    
    let query = ctx.db
      .query("updates")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("acknowledged"), true)); // Filter out acknowledged updates
    
    if (source && source !== "all") {
      query = query.filter((q) => q.eq(q.field("source"), source));
    }
    
    return await query
      .order("desc")
      .take(validatedLimit);
  },
});

// Create update from email summary with validation
export const createUpdateFromEmail = mutation({
  args: v.object({
    emailId: v.string(),
    emailData: v.object({
      from: v.object({
        name: v.optional(v.string()),
        email: v.string(),
      }),
      subject: v.string(),
      date: v.number(),
    }),
    update: v.object({
      type: v.string(),
      category: v.optional(v.string()), // 'fashion_ops' or 'general'
      summary: v.string(),
      urgency: v.optional(v.string()),
      sourceQuote: v.optional(v.string()),
      skuUpdates: v.optional(v.array(v.object({
        skuCode: v.string(),
        field: v.string(),
        newValue: v.string(),
        confidence: v.number(),
      }))),
    }),
  }),
  handler: async (ctx, { emailId, emailData, update }) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    
    // Create title based on update type using constants
    const updateType = update.type as keyof typeof UPDATE_TYPE_EMOJIS;
    const emoji = UPDATE_TYPE_EMOJIS[updateType] || UPDATE_TYPE_EMOJIS.general;
    const typeLabel = update.type.charAt(0).toUpperCase() + update.type.slice(1);
    const title = `${emoji} ${typeLabel} Update`;
    
    const updateId = await ctx.db.insert("updates", {
      userId,
      source: "email",
      sourceId: emailId,
      type: update.type,
      category: update.category, // Store category
      title,
      summary: update.summary,
      urgency: update.urgency,
      fromName: emailData.from.name || emailData.from.email,
      fromId: emailData.from.email,
      sourceSubject: emailData.subject,
      sourceQuote: update.sourceQuote,
      sourceDate: emailData.date,
      skuUpdates: update.skuUpdates,
      actionsNeeded: [],
      createdAt: now,
      processed: false,
    });
    
    // Process SKU updates if present
    if (update.skuUpdates && update.skuUpdates.length > 0) {
      for (const skuUpdate of update.skuUpdates) {
        await ctx.runMutation(api.tracking.upsertSKUFromEmail, {
          skuCode: skuUpdate.skuCode,
          updates: {
            [skuUpdate.field]: skuUpdate.newValue,
          },
          sourceEmailId: emailId,
          sourceQuote: update.sourceQuote || "",
          confidence: skuUpdate.confidence,
        });
      }
      
      // Mark as processed
      await ctx.db.patch(updateId, { processed: true });
    }
    
    return updateId;
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
      
      // Process each update in the summary
      if (summaryData.updates && Array.isArray(summaryData.updates)) {
        for (const update of summaryData.updates) {
          // Extract SKU changes from this specific update
          const relatedSkuChanges = summaryData.skuChanges?.filter((sku: { skuCode: string; sourceQuote?: string }) => 
            update.sourceQuote?.includes(sku.skuCode) ||
            update.summary?.includes(sku.skuCode)
          );
          
          const updateId = await ctx.db.insert("updates", {
            userId,
            source: "email",
            sourceId: update.sourceEmailId || emailIds[0],
            type: update.type || "general",
            category: update.category || (update.type === "general" ? "general" : "fashion_ops"),
            title: update.summary.substring(0, 50),
            summary: update.summary,
            urgency: update.urgency || "medium",
            fromName: update.from,
            sourceSubject: update.sourceSubject,
            sourceQuote: update.sourceQuote,
            sourceDate: update.sourceDate,
            skuUpdates: relatedSkuChanges?.map((sku: { 
              skuCode: string; 
              field: string; 
              currentValue?: string; 
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
        }
      }
      
      // Process action items
      if (summaryData.actionsNeeded && Array.isArray(summaryData.actionsNeeded)) {
        for (const action of summaryData.actionsNeeded) {
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
        }
      }
      
      // Process SKU updates through tracking system
      if (summaryData.skuChanges && Array.isArray(summaryData.skuChanges)) {
        await ctx.runMutation(api.tracking.processSKUUpdatesFromEmail, {
          emailId: emailIds[0],
          skuUpdates: summaryData.skuChanges.map((change: {
            skuCode: string;
            productName?: string;
            field: string;
            newValue: string;
            sourceQuote: string;
            confidence?: number;
          }) => ({
            skuCode: change.skuCode,
            productName: change.productName,
            field: change.field,
            newValue: change.newValue,
            sourceQuote: change.sourceQuote,
            confidence: typeof change.confidence === 'number' ? change.confidence : 0.8,
          })),
        });
        
        // Mark updates as processed
        for (const id of createdUpdates) {
          await ctx.db.patch(id, { processed: true });
        }
      }
      
      return { created: createdUpdates.length };
    } catch {
      // Silent failure - email summary processing is best effort
      return { created: 0 };
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
    await ctx.db.patch(updateId, { 
      acknowledged: true,
      acknowledgedAt: Date.now()
    });
    
    return { success: true };
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