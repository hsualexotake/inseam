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

// Action item
export interface ActionItem {
  action: string;
  completed: boolean;
  completedAt?: number;
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