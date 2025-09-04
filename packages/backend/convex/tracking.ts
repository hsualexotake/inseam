import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { optionalAuth, requireAuth } from "./helpers/auth";
import { QUERY_LIMITS, CONFIDENCE_THRESHOLDS, SKU_FIELD_MAPPINGS, ERROR_MESSAGES, DEFAULTS } from "./constants";
import type { UpdateHistory, SKUTrackingDocument, SKUUpdates } from "./types/index";
import { extractSKUDataFromEmail } from "./skuExtraction";

/**
 * Simplified SKU Tracking System
 * Single source of truth for all SKU information
 */

// Helper to build update history entries
function buildUpdateHistory(
  existing: Partial<SKUTrackingDocument>,
  updates: SKUUpdates,
  sourceEmailId: string | undefined,
  sourceQuote: string,
  confidence: number,
  timestamp: number
): UpdateHistory[] {
  const history: UpdateHistory[] = [];
  
  Object.entries(updates).forEach(([field, newValue]) => {
    if (newValue !== undefined && newValue !== null) {
      const oldValue = existing[field as keyof SKUTrackingDocument];
      if (oldValue !== newValue) {
        history.push({
          field,
          oldValue: oldValue?.toString(),
          newValue: newValue.toString(),
          sourceEmailId,
          sourceQuote,
          confidence,
          timestamp,
        });
      }
    }
  });
  
  return history;
}

// Get all SKUs for the current user with proper validation
export const getAllSKUs = query({
  args: v.object({
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  }),
  handler: async (ctx, { limit = QUERY_LIMITS.DEFAULT, status }) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return [];
    
    // Validate and cap limit to prevent memory issues
    const validatedLimit = Math.min(Math.max(1, limit), QUERY_LIMITS.MAX);
    
    // Use the appropriate index based on whether status is provided
    if (status && status !== "all") {
      // Use the by_user_status index for filtered queries
      return await ctx.db
        .query("skuTracking")
        .withIndex("by_user_status", (q) => 
          q.eq("userId", userId).eq("status", status)
        )
        .order("desc")
        .take(validatedLimit);
    } else {
      // Use the by_user index for all SKUs
      return await ctx.db
        .query("skuTracking")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(validatedLimit);
    }
  },
});

// Get a specific SKU with validation
export const getSKU = query({
  args: v.object({
    skuCode: v.string(),
  }),
  handler: async (ctx, { skuCode }) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return null;
    
    // Validate SKU code format
    if (!skuCode || skuCode.length > 100) {
      throw new Error(ERROR_MESSAGES.INVALID_INPUT);
    }
    
    return await ctx.db
      .query("skuTracking")
      .withIndex("by_user_sku", (q) => 
        q.eq("userId", userId).eq("skuCode", skuCode)
      )
      .first();
  },
});

// Upsert SKU from email extraction with full validation
export const upsertSKUFromEmail = mutation({
  args: v.object({
    skuCode: v.string(),
    updates: v.object({
      productName: v.optional(v.string()),
      category: v.optional(v.string()),
      trackingNumber: v.optional(v.string()),
      status: v.optional(v.string()),
      deliveryDate: v.optional(v.string()),
      quantity: v.optional(v.number()),
      supplier: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
    sourceEmailId: v.string(),
    sourceQuote: v.string(),
    confidence: v.number(),
  }),
  handler: async (ctx, { skuCode, updates, sourceEmailId, sourceQuote, confidence }) => {
    const userId = await requireAuth(ctx);
    
    // Validate inputs
    if (!skuCode || skuCode.length > 100) {
      throw new Error(ERROR_MESSAGES.INVALID_INPUT);
    }
    
    if (confidence < 0 || confidence > 1) {
      throw new Error("Confidence must be between 0 and 1");
    }
    const now = Date.now();
    
    // Check if SKU exists
    const existing = await ctx.db
      .query("skuTracking")
      .withIndex("by_user_sku", (q) => 
        q.eq("userId", userId).eq("skuCode", skuCode)
      )
      .first();
    
    // Only apply updates if confidence is above threshold
    const shouldApply = confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPLY;
    
    if (!existing) {
      // Create new SKU if confidence is high enough
      if (shouldApply) {
        await ctx.db.insert("skuTracking", {
          userId,
          skuCode,
          productName: updates.productName || skuCode,
          category: updates.category,
          trackingNumber: updates.trackingNumber,
          status: updates.status || DEFAULTS.SKU_STATUS,
          deliveryDate: updates.deliveryDate,
          quantity: updates.quantity,
          supplier: updates.supplier,
          notes: updates.notes,
          lastUpdatedFrom: sourceEmailId,
          lastUpdatedAt: now,
          lastUpdateConfidence: confidence,
          updateHistory: [],
          createdAt: now,
        });
      }
    } else {
      // Update existing SKU
      const history = existing.updateHistory || [];
      const newHistory = buildUpdateHistory(
        existing,
        updates,
        sourceEmailId,
        sourceQuote,
        confidence,
        now
      );
      
      if (shouldApply && newHistory.length > 0) {
        // Apply the updates
        await ctx.db.patch(existing._id, {
          ...updates,
          lastUpdatedFrom: sourceEmailId,
          lastUpdatedAt: now,
          lastUpdateConfidence: confidence,
          updateHistory: [...history, ...newHistory].slice(-QUERY_LIMITS.SKU_HISTORY), // Keep last N updates
        });
      } else if (!shouldApply && newHistory.length > 0) {
        // Just log the low-confidence update in history without applying
        await ctx.db.patch(existing._id, {
          updateHistory: [...history, ...newHistory].slice(-QUERY_LIMITS.SKU_HISTORY),
        });
      }
    }
    
    return { applied: shouldApply, confidence };
  },
});

// Manual SKU update (from UI) with validation
export const updateSKU = mutation({
  args: v.object({
    skuCode: v.string(),
    updates: v.object({
      productName: v.optional(v.string()),
      category: v.optional(v.string()),
      trackingNumber: v.optional(v.string()),
      status: v.optional(v.string()),
      deliveryDate: v.optional(v.string()),
      quantity: v.optional(v.number()),
      supplier: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  }),
  handler: async (ctx, { skuCode, updates }) => {
    const userId = await requireAuth(ctx);
    
    // Validate inputs
    if (!skuCode || skuCode.length > 100) {
      throw new Error(ERROR_MESSAGES.INVALID_INPUT);
    }
    const now = Date.now();
    
    const existing = await ctx.db
      .query("skuTracking")
      .withIndex("by_user_sku", (q) => 
        q.eq("userId", userId).eq("skuCode", skuCode)
      )
      .first();
    
    if (!existing) {
      // Create new SKU
      await ctx.db.insert("skuTracking", {
        userId,
        skuCode,
        productName: updates.productName || skuCode,
        category: updates.category,
        trackingNumber: updates.trackingNumber,
        status: updates.status || "pending",
        deliveryDate: updates.deliveryDate,
        quantity: updates.quantity,
        supplier: updates.supplier,
        notes: updates.notes,
        lastUpdatedFrom: "manual",
        lastUpdatedAt: now,
        lastUpdateConfidence: 1.0,
        updateHistory: [],
        createdAt: now,
      });
    } else {
      // Update existing
      const history = existing.updateHistory || [];
      const newHistory = buildUpdateHistory(
        existing,
        updates,
        undefined,
        "Manual update",
        1.0,
        now
      );
      
      await ctx.db.patch(existing._id, {
        ...updates,
        lastUpdatedFrom: "manual",
        lastUpdatedAt: now,
        lastUpdateConfidence: 1.0,
        updateHistory: [...history, ...newHistory].slice(-20),
      });
    }
    
    return { success: true };
  },
});

// Process SKU updates from email summary with validation
export const processSKUUpdatesFromEmail = mutation({
  args: v.object({
    emailId: v.string(),
    skuUpdates: v.array(v.object({
      skuCode: v.string(),
      productName: v.optional(v.string()),
      field: v.string(),
      newValue: v.string(),
      sourceQuote: v.string(),
      confidence: v.number(),
    })),
  }),
  handler: async (ctx, { emailId, skuUpdates }) => {
    await requireAuth(ctx);
    
    // Validate array size to prevent memory issues
    if (skuUpdates.length > 100) {
      throw new Error("Too many SKU updates in single request. Maximum 100 allowed.");
    }
    
    let applied = 0;
    let skipped = 0;
    
    for (const update of skuUpdates) {
      // Map field names to our schema using constants
      const mappedFieldName = SKU_FIELD_MAPPINGS[update.field as keyof typeof SKU_FIELD_MAPPINGS];
      const fieldName = mappedFieldName || update.field.toLowerCase();
      
      // Create updates object with proper typing
      const updates: SKUUpdates = {};
      if (update.productName) updates.productName = update.productName;
      
      // Only set fields that exist in SKUUpdates type
      if (fieldName === 'deliveryDate') updates.deliveryDate = update.newValue;
      else if (fieldName === 'trackingNumber') updates.trackingNumber = update.newValue;
      else if (fieldName === 'status') updates.status = update.newValue;
      else if (fieldName === 'quantity' && !isNaN(Number(update.newValue))) {
        updates.quantity = Number(update.newValue);
      }
      else if (fieldName === 'supplier') updates.supplier = update.newValue;
      else if (fieldName === 'notes') updates.notes = update.newValue;
      else if (fieldName === 'category') updates.category = update.newValue;
      
      // Process the update
      const result = await ctx.runMutation(api.tracking.upsertSKUFromEmail, {
        skuCode: update.skuCode,
        updates,
        sourceEmailId: emailId,
        sourceQuote: update.sourceQuote,
        confidence: update.confidence,
      });
      
      if (result.applied) {
        applied++;
      } else {
        skipped++;
      }
    }
    
    return { applied, skipped };
  },
});

// Initialize sample data (for testing) with validation
export const initializeSampleSKUs = mutation({
  args: v.object({}),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    
    const sampleSKUs = [
      {
        skuCode: "SS26-DRS-001-BLK-S",
        productName: "Summer Midi Dress",
        category: "Dresses",
        status: "in_transit" as const,
        trackingNumber: "1234567890",
        deliveryDate: "2025-09-15",
      },
      {
        skuCode: "FW25-JKT-002-NVY-M",
        productName: "Wool Blazer",
        category: "Jackets",
        status: DEFAULTS.SKU_STATUS,
      },
      {
        skuCode: "SKU-56",
        productName: "Cotton T-Shirt",
        category: "Tops",
        status: "delivered",
        deliveryDate: "2025-08-30",
      },
    ];
    
    for (const sku of sampleSKUs) {
      // Check if already exists
      const existing = await ctx.db
        .query("skuTracking")
        .withIndex("by_user_sku", (q) => 
          q.eq("userId", userId).eq("skuCode", sku.skuCode)
        )
        .first();
      
      if (!existing) {
        await ctx.db.insert("skuTracking", {
          userId,
          ...sku,
          lastUpdatedFrom: "manual",
          lastUpdatedAt: now,
          lastUpdateConfidence: 1.0,
          updateHistory: [],
          createdAt: now,
        });
      }
    }
    
    return { success: true };
  },
});

// Get pending changes for review (migrated from skuChanges.ts)
export const getPendingChanges = query({
  args: v.object({
    limit: v.optional(v.number()),
  }),
  handler: async (ctx, { limit = QUERY_LIMITS.DEFAULT }) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return [];
    
    const validatedLimit = Math.min(Math.max(1, limit), QUERY_LIMITS.MAX);
    
    // Get SKUs with low-confidence updates in history
    const skus = await ctx.db
      .query("skuTracking")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(validatedLimit);
    
    const pendingChanges = [];
    for (const sku of skus) {
      if (sku.updateHistory) {
        const lowConfidenceUpdates = sku.updateHistory.filter(
          h => h.confidence && h.confidence < CONFIDENCE_THRESHOLDS.AUTO_APPLY
        );
        if (lowConfidenceUpdates.length > 0) {
          pendingChanges.push({
            skuCode: sku.skuCode,
            changes: lowConfidenceUpdates,
          });
        }
      }
    }
    
    return pendingChanges;
  },
});

// Process email content and extract SKU updates (migrated from skuUpdates.ts)
export const processEmailSKUUpdates = action({
  args: v.object({
    emailId: v.string(),
    emailSubject: v.string(),
    emailContent: v.string(),
    skuUpdates: v.optional(v.array(v.object({
      skuCode: v.string(),
      trackingNumber: v.optional(v.string()),
      status: v.optional(v.string()),
      deliveryDate: v.optional(v.string()),
      quantity: v.optional(v.number()),
      supplier: v.optional(v.string()),
      sourceQuote: v.string(),
    }))),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx); // Ensure user is authenticated
    
    const results = [];
    
    // If skuUpdates are provided by the AI, use those
    // Otherwise, fall back to pattern extraction
    let updates = args.skuUpdates || [];
    
    if (updates.length === 0) {
      // Extract SKU data using patterns
      const extracted = extractSKUDataFromEmail(args.emailContent, args.emailSubject);
      updates = extracted.map(data => ({
        skuCode: data.skuCode,
        trackingNumber: data.trackingNumber,
        status: data.status,
        deliveryDate: data.deliveryDate,
        quantity: data.quantity,
        supplier: data.supplier,
        sourceQuote: data.sourceQuote,
      }));
    }
    
    for (const update of updates) {
      try {
        // Process each SKU update with proper typing
        const updateData: SKUUpdates = {};
        if (update.trackingNumber) updateData.trackingNumber = update.trackingNumber;
        if (update.status) updateData.status = update.status;
        if (update.deliveryDate) updateData.deliveryDate = update.deliveryDate;
        if (update.quantity) updateData.quantity = update.quantity;
        if (update.supplier) updateData.supplier = update.supplier;
        
        await ctx.runMutation(api.tracking.upsertSKUFromEmail, {
          skuCode: update.skuCode,
          updates: updateData,
          sourceEmailId: args.emailId,
          sourceQuote: update.sourceQuote,
          confidence: 0.8, // High confidence if from AI
        });
        
        results.push({
          skuCode: update.skuCode,
          status: "updated",
          message: `Updated SKU ${update.skuCode}`,
        });
      } catch (error) {
        results.push({
          skuCode: update.skuCode,
          status: "error",
          message: `Error processing SKU ${update.skuCode}: ${error}`,
        });
      }
    }
    
    return results;
  },
});

// Get SKU update history/logs
export const getSKUUpdateHistory = query({
  args: v.object({
    skuCode: v.optional(v.string()),
    limit: v.optional(v.number()),
  }),
  handler: async (ctx, { skuCode, limit = 20 }) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return [];
    
    const validatedLimit = Math.min(Math.max(1, limit), QUERY_LIMITS.MAX);
    
    if (skuCode) {
      const sku = await ctx.db
        .query("skuTracking")
        .withIndex("by_user_sku", (q) => 
          q.eq("userId", userId).eq("skuCode", skuCode)
        )
        .first();
      
      return sku?.updateHistory?.slice(-validatedLimit) || [];
    } else {
      // Get recent updates across all SKUs
      const skus = await ctx.db
        .query("skuTracking")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10);
      
      const allHistory = [];
      for (const sku of skus) {
        if (sku.updateHistory) {
          allHistory.push(...sku.updateHistory.map(h => ({
            ...h,
            skuCode: sku.skuCode,
          })));
        }
      }
      
      // Sort by timestamp and return most recent
      return allHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, validatedLimit);
    }
  },
});

// Import api for internal use
import { api } from "./_generated/api";