import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAuth } from "./helpers/auth";

/**
 * Unified Updates System
 * Central hub for all update sources (email, wechat, whatsapp, etc)
 */


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



