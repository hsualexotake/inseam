"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import { ColumnDefinition } from "@packages/backend/convex/types/tracker";
import { X } from "lucide-react";

interface AddRowModalProps {
  tracker: {
    _id: Id<"trackers">;
    name: string;
    columns: ColumnDefinition[];
    primaryKeyColumn: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddRowModal({ tracker, onClose, onSuccess }: AddRowModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  
  const addRow = useMutation(api.trackers.addRow);
  
  // Sort columns by order
  const sortedColumns = [...tracker.columns].sort((a, b) => a.order - b.order);
  
  // Update form field
  const updateField = (key: string, value: any) => {
    setFormData({ ...formData, [key]: value });
    // Clear error for this field
    if (errors[key]) {
      setErrors({ ...errors, [key]: "" });
    }
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    for (const column of tracker.columns) {
      const value = formData[column.key];
      
      if (column.required && !value) {
        newErrors[column.key] = `${column.name} is required`;
      }
      
      if (column.type === "number" && value && isNaN(Number(value))) {
        newErrors[column.key] = `${column.name} must be a number`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    try {
      await addRow({
        trackerId: tracker._id,
        data: formData,
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to add row:", error);
      alert("Failed to add row. Please check your data and try again.");
    } finally {
      setSaving(false);
    }
  };
  
  // Render form field
  const renderField = (column: ColumnDefinition) => {
    const value = formData[column.key] || "";
    const error = errors[column.key];
    
    const commonProps = {
      id: column.key,
      name: column.key,
      className: `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error ? "border-red-500" : "border-gray-300"
      }`,
    };
    
    let input;
    
    switch (column.type) {
      case "select":
        input = (
          <select
            {...commonProps}
            value={value}
            onChange={(e) => updateField(column.key, e.target.value)}
          >
            <option value="">Select...</option>
            {column.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
        break;
      
      case "boolean":
        input = (
          <div className="flex items-center">
            <input
              type="checkbox"
              id={column.key}
              name={column.key}
              checked={value || false}
              onChange={(e) => updateField(column.key, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor={column.key} className="ml-2 text-sm text-gray-700">
              {value ? "Yes" : "No"}
            </label>
          </div>
        );
        break;
      
      case "date":
        input = (
          <input
            {...commonProps}
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ""}
            onChange={(e) => updateField(column.key, e.target.value)}
          />
        );
        break;
      
      case "number":
        input = (
          <input
            {...commonProps}
            type="number"
            value={value}
            onChange={(e) => updateField(column.key, e.target.value)}
            placeholder="0"
          />
        );
        break;
      
      default:
        input = (
          <input
            {...commonProps}
            type="text"
            value={value}
            onChange={(e) => updateField(column.key, e.target.value)}
            placeholder={`Enter ${column.name.toLowerCase()}`}
          />
        );
    }
    
    return (
      <div key={column.id}>
        <label htmlFor={column.key} className="block text-sm font-medium text-gray-700 mb-1">
          {column.name}
          {column.required && <span className="text-red-500 ml-1">*</span>}
          {column.key === tracker.primaryKeyColumn && (
            <span className="ml-2 text-xs text-blue-600">(Primary Key)</span>
          )}
        </label>
        {input}
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add New Row</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {sortedColumns.map(column => renderField(column))}
        </form>
        
        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Adding..." : "Add Row"}
          </button>
        </div>
      </div>
    </div>
  );
}