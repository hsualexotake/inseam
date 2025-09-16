"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Columns } from "lucide-react";

interface Column {
  id: string;
  key: string;
  name: string;
  type: string;
}

interface ColumnMappingDropdownProps {
  currentColumnKey: string;
  currentColumnName: string;
  selectedColumnKey: string;
  availableColumns: Column[];
  onColumnChange: (columnKey: string) => void;
  disabled?: boolean;
}

export default function ColumnMappingDropdown({
  currentColumnKey,
  currentColumnName,
  selectedColumnKey,
  availableColumns,
  onColumnChange,
  disabled = false,
}: ColumnMappingDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedColumn = availableColumns.find(c => c.key === selectedColumnKey) ||
    { name: currentColumnName, key: currentColumnKey };

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

  const handleSelect = (columnKey: string) => {
    onColumnChange(columnKey);
    setIsOpen(false);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "text": return "bg-blue-100 text-blue-700";
      case "number": return "bg-green-100 text-green-700";
      case "date": return "bg-purple-100 text-purple-700";
      case "boolean": return "bg-yellow-100 text-yellow-700";
      case "select": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[150px]"
      >
        <Columns className="h-3.5 w-3.5 text-gray-500" />
        <span className="text-sm text-gray-900 truncate">
          {selectedColumn.name}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="py-1 max-h-60 overflow-auto">
            {availableColumns.map((column) => (
              <button
                key={column.key}
                onClick={() => handleSelect(column.key)}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                  column.key === selectedColumnKey ? "bg-blue-50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm ${column.key === selectedColumnKey ? "text-blue-600 font-medium" : "text-gray-900"}`}>
                    {column.name}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeColor(column.type)}`}>
                    {column.type}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}