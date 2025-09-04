import type { Id } from "../_generated/dataModel";

/**
 * Type definitions for the application
 * Following Convex and TypeScript best practices
 */

// Update sources
export type UpdateSource = "email" | "wechat" | "whatsapp" | "sms" | "manual";

// Update types
export type UpdateType = "shipment" | "delivery" | "delay" | "approval" | "action" | "general" | "in_transit";

// Urgency levels
export type UrgencyLevel = "high" | "medium" | "low";

// SKU status types
export type SKUStatus = "pending" | "shipped" | "in_transit" | "delivered" | "delayed";

// Update history entry
export interface UpdateHistory {
  field: string;
  oldValue?: string;
  newValue: string;
  sourceEmailId?: string;
  sourceQuote?: string;
  confidence: number;
  timestamp: number;
}

// SKU update from email
export interface SKUUpdateFromEmail {
  skuCode: string;
  field: string;
  oldValue?: string;
  newValue: string;
  confidence: number;
}

// Action item
export interface ActionItem {
  action: string;
  completed: boolean;
  completedAt?: number;
}

// Update document
export interface UpdateDocument {
  _id?: Id<"updates">;
  userId: string;
  source: UpdateSource;
  sourceId?: string;
  type: UpdateType;
  title: string;
  summary: string;
  urgency?: UrgencyLevel;
  fromName?: string;
  fromId?: string;
  sourceSubject?: string;
  sourceQuote?: string;
  sourceDate?: number;
  skuUpdates?: SKUUpdateFromEmail[];
  actionsNeeded?: ActionItem[];
  createdAt: number;
  processed: boolean;
}

// SKU tracking document
export interface SKUTrackingDocument {
  _id?: Id<"skuTracking">;
  userId: string;
  skuCode: string;
  productName: string;
  category?: string;
  color?: string;
  size?: string;
  season?: string;
  trackingNumber?: string;
  status?: string;
  deliveryDate?: string;
  quantity?: number;
  supplier?: string;
  notes?: string;
  lastUpdatedFrom?: string;
  lastUpdatedAt: number;
  lastUpdateConfidence?: number;
  updateHistory?: UpdateHistory[];
  createdAt: number;
}

// SKU updates object for mutations
export interface SKUUpdates {
  productName?: string;
  category?: string;
  color?: string;
  size?: string;
  trackingNumber?: string;
  status?: string;
  deliveryDate?: string;
  quantity?: number;
  supplier?: string;
  notes?: string;
}

// Email data structure
export interface EmailData {
  from: {
    name?: string;
    email: string;
  };
  subject: string;
  date: number;
}

// Rate limit response
export interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// Update stats
export interface UpdateStats {
  total: number;
  sources: Record<UpdateSource, number>;
  types: Record<UpdateType, number>;
  pendingActions: number;
}