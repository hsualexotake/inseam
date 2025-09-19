"use client";

import React from "react";
import { DEFAULT_FOLDER_COLORS } from "@packages/backend/convex/lib/folderConstants";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  className?: string;
}

export default function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn("grid grid-cols-8 gap-2", className)}>
      {DEFAULT_FOLDER_COLORS.map((colorOption) => (
        <button
          key={colorOption}
          type="button"
          onClick={() => onChange(colorOption)}
          className={cn(
            "relative w-10 h-10 rounded-lg border-2 transition-all",
            value === colorOption
              ? "border-gray-900 shadow-md scale-110"
              : "border-gray-300 hover:border-gray-400"
          )}
          style={{ backgroundColor: colorOption }}
          aria-label={`Select color ${colorOption}`}
        >
          {value === colorOption && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

export function getColorClasses(color?: string, variant: 'badge' | 'icon' = 'badge') {
  if (!color) {
    if (variant === 'badge') {
      return "bg-gray-100 text-gray-700 border-gray-200";
    }
    return "text-gray-600";
  }

  // Map hex colors to Tailwind-like classes
  const colorMap: { [key: string]: { badge: string; icon: string } } = {
    '#3B82F6': {
      badge: 'bg-blue-100 text-blue-900 border-blue-200',
      icon: 'text-blue-600'
    },
    '#8B5CF6': {
      badge: 'bg-purple-100 text-purple-900 border-purple-200',
      icon: 'text-purple-600'
    },
    '#10B981': {
      badge: 'bg-green-100 text-green-900 border-green-200',
      icon: 'text-green-600'
    },
    '#F59E0B': {
      badge: 'bg-yellow-100 text-yellow-900 border-yellow-200',
      icon: 'text-yellow-600'
    },
    '#EF4444': {
      badge: 'bg-red-100 text-red-900 border-red-200',
      icon: 'text-red-600'
    },
    '#EC4899': {
      badge: 'bg-pink-100 text-pink-900 border-pink-200',
      icon: 'text-pink-600'
    },
    '#6366F1': {
      badge: 'bg-indigo-100 text-indigo-900 border-indigo-200',
      icon: 'text-indigo-600'
    },
    '#6B7280': {
      badge: 'bg-gray-100 text-gray-900 border-gray-200',
      icon: 'text-gray-600'
    },
  };

  const classes = colorMap[color];
  if (classes) {
    return variant === 'badge' ? classes.badge : classes.icon;
  }

  // Fallback for unknown colors
  return variant === 'badge'
    ? "bg-gray-100 text-gray-700 border-gray-200"
    : "text-gray-600";
}