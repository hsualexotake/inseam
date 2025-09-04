import React from 'react';

/**
 * Shared utility functions for email category styling and display
 */

export const CATEGORY_TYPES = ['fashion_ops', 'general'] as const;
export type CategoryType = typeof CATEGORY_TYPES[number];

export const CATEGORY_CONFIG = {
  fashion_ops: {
    label: 'Fashion Ops',
    emoji: '📦',
    colors: {
      badge: 'bg-yellow-100 text-yellow-800',
      high: {
        bg: 'bg-red-50 border-red-200 text-red-900',
        icon: 'text-red-600',
        border: 'border-l-4 border-red-400'
      },
      medium: {
        bg: 'bg-yellow-50 border-yellow-200 text-yellow-900',
        icon: 'text-yellow-600',
        border: 'border-l-4 border-yellow-400'
      },
      low: {
        bg: 'bg-yellow-50/50 border-yellow-100 text-yellow-800',
        icon: 'text-yellow-500',
        border: 'border-l-4 border-yellow-300'
      }
    }
  },
  general: {
    label: 'General',
    emoji: '📧',
    colors: {
      badge: 'bg-blue-100 text-blue-800',
      high: {
        bg: 'bg-purple-50 border-purple-200 text-purple-900',
        icon: 'text-purple-600',
        border: 'border-l-4 border-purple-400'
      },
      medium: {
        bg: 'bg-blue-50 border-blue-200 text-blue-900',
        icon: 'text-blue-600',
        border: 'border-l-4 border-blue-400'
      },
      low: {
        bg: 'bg-blue-50/50 border-blue-100 text-blue-800',
        icon: 'text-blue-500',
        border: 'border-l-4 border-blue-300'
      }
    }
  }
} as const;

/**
 * Get category badge component
 */
export function getCategoryBadge(category?: string) {
  const validCategory = category as CategoryType;
  const config = CATEGORY_CONFIG[validCategory];
  
  if (!config) {
    return null;
  }
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.colors.badge}`}>
      {config.emoji} {config.label}
    </span>
  );
}

/**
 * Get background color classes for updates based on category and urgency
 */
export function getUpdateColor(type: string, urgency: string, category?: string): string {
  const validCategory = (category || 'general') as CategoryType;
  const config = CATEGORY_CONFIG[validCategory];
  
  if (!config) {
    return CATEGORY_CONFIG.general.colors.low.bg;
  }
  
  // Special case for delays - always high urgency
  if (type === 'delay' && validCategory === 'fashion_ops') {
    return config.colors.high.bg;
  }
  
  const urgencyLevel = urgency as 'high' | 'medium' | 'low';
  return config.colors[urgencyLevel]?.bg || config.colors.low.bg;
}

/**
 * Get icon color classes based on category and urgency
 */
export function getIconColor(type: string, urgency: string, category?: string): string {
  const validCategory = (category || 'general') as CategoryType;
  const config = CATEGORY_CONFIG[validCategory];
  
  if (!config) {
    return CATEGORY_CONFIG.general.colors.low.icon;
  }
  
  // Special case for delays
  if (type === 'delay' && validCategory === 'fashion_ops') {
    return config.colors.high.icon;
  }
  
  const urgencyLevel = urgency as 'high' | 'medium' | 'low';
  return config.colors[urgencyLevel]?.icon || config.colors.low.icon;
}

/**
 * Get border color classes for UnifiedUpdates component
 */
export function getCategoryColor(category?: string, urgency?: string): string {
  const validCategory = (category || 'general') as CategoryType;
  const config = CATEGORY_CONFIG[validCategory];
  
  if (!config) {
    return CATEGORY_CONFIG.general.colors.low.border;
  }
  
  const urgencyLevel = urgency as 'high' | 'medium' | 'low';
  return config.colors[urgencyLevel]?.border || config.colors.low.border;
}

/**
 * Validate if a category is valid
 */
export function isValidCategory(category: string): category is CategoryType {
  return CATEGORY_TYPES.includes(category as CategoryType);
}