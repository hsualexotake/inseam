"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Database } from "lucide-react";
import type { Id } from "@packages/backend/convex/_generated/dataModel";

interface TrackerSelectorProps {
  trackers: Array<{
    _id: Id<"trackers">;
    name: string;
  }>;
  selectedTrackerId: Id<"trackers">;
  onTrackerChange: (trackerId: Id<"trackers">) => void;
  disabled?: boolean;
}

export default function TrackerSelector({
  trackers,
  selectedTrackerId,
  onTrackerChange,
  disabled = false,
}: TrackerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedTracker = trackers.find(t => t._id === selectedTrackerId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (trackerId: Id<"trackers">) => {
    onTrackerChange(trackerId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Database className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-900">
          {selectedTracker?.name || "Select Tracker"}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="py-1 max-h-60 overflow-auto">
            {trackers.map((tracker) => (
              <button
                key={tracker._id}
                onClick={() => handleSelect(tracker._id)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                  tracker._id === selectedTrackerId ? "bg-blue-50 text-blue-600" : "text-gray-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-gray-400" />
                  <span>{tracker.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}