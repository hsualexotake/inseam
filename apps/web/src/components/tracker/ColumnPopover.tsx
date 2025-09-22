"use client";

import React, { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import { ColumnDefinition } from "@packages/backend/convex/types/tracker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ColorPicker, { getColorClasses } from "@/components/ui/ColorPicker";
import { InfoIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ColumnPopoverProps {
  column: ColumnDefinition;
  trackerId: Id<"trackers">;
  isPrimaryKey?: boolean;
  children: React.ReactNode;
}

export default function ColumnPopover({
  column,
  trackerId,
  isPrimaryKey = false,
  children,
}: ColumnPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(column.aiEnabled || false);
  const [selectedColor, setSelectedColor] = useState(column.color);
  const [isUpdating, setIsUpdating] = useState(false);

  const updateAIStatus = useMutation(api.trackers.updateColumnAIStatus);
  const updateColor = useMutation(api.trackers.updateColumnColor);

  // Sync local state with props when column changes
  useEffect(() => {
    setAiEnabled(column.aiEnabled || false);
    setSelectedColor(column.color);
  }, [column.aiEnabled, column.color]);

  const handleAIToggle = async () => {
    setIsUpdating(true);
    try {
      const newValue = !aiEnabled;
      await updateAIStatus({
        trackerId,
        columnId: column.id,
        aiEnabled: newValue,
      });
      setAiEnabled(newValue);
    } catch (error) {
      console.error("Failed to update AI status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleColorChange = async (color: string) => {
    setIsUpdating(true);
    try {
      await updateColor({
        trackerId,
        columnId: column.id,
        color,
      });
      setSelectedColor(color);
    } catch (error) {
      console.error("Failed to update color:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Generate description based on column type or custom description
  const description = column.description ||
    (isPrimaryKey
      ? "This column serves as the unique identifier for each row in the tracker"
      : `Column type: ${column.type}${column.required ? " (Required)" : " (Optional)"}`);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h4 className="font-semibold text-sm text-gray-900">{column.name}</h4>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          </div>

          {/* AI Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">AI Enabled</span>
            </div>
            <button
              onClick={handleAIToggle}
              disabled={isUpdating}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                aiEnabled ? "bg-yellow-600" : "bg-gray-200",
                isUpdating && "opacity-50 cursor-not-allowed"
              )}
              aria-label="Toggle AI"
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  aiEnabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-sm font-medium mb-2 block">Column Color</label>
            <ColorPicker
              value={selectedColor}
              onChange={handleColorChange}
              className="grid-cols-4 gap-1.5"
            />
          </div>

          {/* Column Info */}
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Type:</span>
                <span className="font-medium">{column.type}</span>
              </div>
              <div className="flex justify-between">
                <span>Key:</span>
                <span className="font-medium font-mono">{column.key}</span>
              </div>
              {column.options && column.options.length > 0 && (
                <div className="flex justify-between">
                  <span>Options:</span>
                  <span className="font-medium">{column.options.length} values</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Export a utility component for column header with badge
export function ColumnHeader({
  column,
  isPrimaryKey = false,
  trackerId,
  required = false,
}: {
  column: ColumnDefinition;
  isPrimaryKey?: boolean;
  trackerId: Id<"trackers">;
  required?: boolean;
}) {
  const hasPopoverContent = true; // All columns now have popover

  return (
    <ColumnPopover column={column} trackerId={trackerId} isPrimaryKey={isPrimaryKey}>
      <button
        className={cn(
          "flex items-center gap-1.5 text-left",
          hasPopoverContent && "hover:text-blue-600 transition-colors cursor-pointer"
        )}
      >
        {column.color ? (
          <span
            className={cn(
              "inline-block px-1.5 py-0.5 rounded text-xs font-medium",
              getColorClasses(column.color, 'badge')
            )}
          >
            {column.name}
          </span>
        ) : (
          <span>{column.name}</span>
        )}
        {column.aiEnabled && (
          <Sparkles className="h-3 w-3 text-yellow-500" />
        )}
        <InfoIcon className="h-3 w-3 opacity-60" />
        {required && <span className="text-red-500">*</span>}
      </button>
    </ColumnPopover>
  );
}