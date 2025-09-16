"use client";

import { useState, useEffect } from "react";
import { Calendar, Hash, Type, ToggleLeft } from "lucide-react";

interface EditableValueProps {
  value: string | number | boolean | null;
  type: string;
  onChange: (value: any) => void;
  disabled?: boolean;
  options?: string[]; // For select type
}

export default function EditableValue({
  value,
  type,
  onChange,
  disabled = false,
  options = [],
}: EditableValueProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: any) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const formatDateValue = (val: any) => {
    if (!val) return "";

    // If it's a timestamp, convert to date string
    if (typeof val === "number") {
      return new Date(val).toISOString().split("T")[0];
    }

    // If it's already a date string, return as is
    if (typeof val === "string") {
      // Check if it's a valid date format
      if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return val;
      }
      // Try to parse and format
      try {
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      } catch {}
    }

    return String(val);
  };


  const getIcon = () => {
    switch (type) {
      case "text": return <Type className="h-3.5 w-3.5 text-gray-400" />;
      case "number": return <Hash className="h-3.5 w-3.5 text-gray-400" />;
      case "date": return <Calendar className="h-3.5 w-3.5 text-gray-400" />;
      case "boolean": return <ToggleLeft className="h-3.5 w-3.5 text-gray-400" />;
      default: return null;
    }
  };

  const renderInput = () => {
    switch (type) {
      case "text":
        return (
          <input
            type="text"
            value={String(localValue || "")}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            placeholder="Enter text..."
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={typeof localValue === "number" ? localValue : ""}
            onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : null)}
            disabled={disabled}
            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            placeholder="Enter number..."
          />
        );

      case "date":
        return (
          <input
            type="date"
            value={formatDateValue(localValue)}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        );

      case "boolean":
        return (
          <button
            onClick={() => handleChange(!localValue)}
            disabled={disabled}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              localValue
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {localValue ? "Yes" : "No"}
          </button>
        );

      case "select":
        return (
          <select
            value={String(localValue || "")}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">Select...</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={String(localValue || "")}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            placeholder="Enter value..."
          />
        );
    }
  };

  return (
    <div className="flex items-center gap-2 flex-1">
      {getIcon()}
      <div className="flex-1 min-w-[150px]">
        {renderInput()}
      </div>
    </div>
  );
}