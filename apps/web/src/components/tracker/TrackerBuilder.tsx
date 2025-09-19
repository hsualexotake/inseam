"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { useRouter } from "next/navigation";
import { ColumnDefinition } from "@packages/backend/convex/types/tracker";
import ColorPicker from "@/components/ui/ColorPicker";
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  Package,
  Truck,
  Grid3x3,
  ChevronDown,
  ChevronUp,
  Settings,
  Zap,
  Palette
} from "lucide-react";

export default function TrackerBuilder({ trackerId }: { trackerId?: string }) {
  const router = useRouter();
  const createTracker = useMutation(api.trackers.createTracker);
  const updateTracker = useMutation(api.trackers.updateTracker);
  const templates = useQuery(api.trackers.getTemplates);

  // Convert string trackerId to Convex ID type if present
  const trackerIdTyped = trackerId ? (trackerId as any) : undefined;
  const existingTracker = useQuery(
    api.trackers.getTracker,
    trackerIdTyped ? { trackerId: trackerIdTyped } : "skip"
  );
  
  // State - Initialize with existing tracker data if in edit mode
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>("");
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [primaryKeyColumn, setPrimaryKeyColumn] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load existing tracker data when editing
  React.useEffect(() => {
    if (existingTracker && !dataLoaded) {
      setName(existingTracker.name);
      setDescription(existingTracker.description || "");
      setColor(existingTracker.color || "");
      setColumns(existingTracker.columns as ColumnDefinition[]);
      setPrimaryKeyColumn(existingTracker.primaryKeyColumn);
      setDataLoaded(true);
    }
  }, [existingTracker, dataLoaded]);
  
  // Load template
  const loadTemplate = (templateKey: string) => {
    const template = templates?.find(t => t.key === templateKey);
    if (template) {
      setColumns(template.columns as ColumnDefinition[]);
      setPrimaryKeyColumn(template.primaryKeyColumn);
      setSelectedTemplate(templateKey);
    }
  };
  
  // Add new column
  const addColumn = () => {
    const newColumn: ColumnDefinition = {
      id: `col_${Date.now()}`,
      name: "New Column",
      key: `column_${columns.length + 1}`,
      type: "text",
      required: false,
      order: columns.length,
    };
    setColumns([...columns, newColumn]);
    setExpandedColumns(new Set([...expandedColumns, newColumn.id]));
    
    // Auto-select first column as primary key if none selected
    if (columns.length === 0 && !primaryKeyColumn) {
      setPrimaryKeyColumn(newColumn.key);
    }
  };
  
  // Update column
  const updateColumn = (id: string, updates: Partial<ColumnDefinition>) => {
    setColumns(columns.map(col => 
      col.id === id ? { ...col, ...updates } : col
    ));
  };
  
  // Delete column
  const deleteColumn = (id: string) => {
    setColumns(columns.filter(col => col.id !== id));
    if (primaryKeyColumn === columns.find(c => c.id === id)?.key) {
      setPrimaryKeyColumn("");
    }
  };
  
  // Move column
  const moveColumn = (index: number, direction: "up" | "down") => {
    const newColumns = [...columns];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < columns.length) {
      [newColumns[index], newColumns[newIndex]] = [newColumns[newIndex], newColumns[index]];
      newColumns[index].order = index;
      newColumns[newIndex].order = newIndex;
      setColumns(newColumns);
    }
  };
  
  // Add option for select type
  const addOption = (columnId: string, option: string) => {
    const column = columns.find(c => c.id === columnId);
    if (column && option.trim()) {
      const options = column.options || [];
      updateColumn(columnId, { options: [...options, option.trim()] });
    }
  };
  
  // Remove option
  const removeOption = (columnId: string, index: number) => {
    const column = columns.find(c => c.id === columnId);
    if (column?.options) {
      const newOptions = [...column.options];
      newOptions.splice(index, 1);
      updateColumn(columnId, { options: newOptions });
    }
  };
  
  // Add AI alias
  const addAiAlias = (columnId: string, alias: string) => {
    const column = columns.find(c => c.id === columnId);
    if (column && alias.trim()) {
      const aliases = column.aiAliases || [];
      updateColumn(columnId, { aiAliases: [...aliases, alias.trim()] });
    }
  };
  
  // Remove AI alias
  const removeAiAlias = (columnId: string, index: number) => {
    const column = columns.find(c => c.id === columnId);
    if (column?.aiAliases) {
      const newAliases = [...column.aiAliases];
      newAliases.splice(index, 1);
      updateColumn(columnId, { aiAliases: newAliases });
    }
  };
  
  // Save tracker (create or update)
  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a tracker name");
      return;
    }

    if (columns.length === 0) {
      alert("Please add at least one column");
      return;
    }

    if (!primaryKeyColumn) {
      alert("Please select a primary key column");
      return;
    }

    setSaving(true);
    try {
      if (trackerId && existingTracker) {
        // Update existing tracker
        await updateTracker({
          trackerId: trackerIdTyped,
          updates: {
            name: name.trim(),
            description: description.trim() || undefined,
            color: color || undefined,
            columns: columns,
            primaryKeyColumn,
          },
        });
        router.push(`/tracker/view/${existingTracker.slug}`);
      } else {
        // Create new tracker
        const result = await createTracker({
          name: name.trim(),
          description: description.trim() || undefined,
          color: color || undefined,
          columns: columns,
          primaryKeyColumn,
        });
        router.push(`/tracker/view/${result.slug}`);
      }
    } catch (error) {
      console.error(trackerId ? "Failed to update tracker:" : "Failed to create tracker:", error);
      alert(trackerId ? "Failed to update tracker. Please try again." : "Failed to create tracker. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {trackerId ? "Edit Tracker" : "Create New Tracker"}
        </h2>
        
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tracker Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., SS26 Production Tracker"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this tracker is for..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Tracker Color
              </div>
            </label>
            <ColorPicker
              value={color}
              onChange={setColor}
            />
          </div>
        </div>
      </div>
      
      {/* Templates */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Start from Template</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates?.map((template) => (
            <button
              key={template.key}
              onClick={() => loadTemplate(template.key)}
              className={`p-4 border rounded-lg text-left hover:bg-gray-50 transition-colors ${
                selectedTemplate === template.key ? "border-blue-500 bg-blue-50" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                {template.key === "fashion" && <Package className="h-5 w-5 text-blue-600" />}
                {template.key === "logistics" && <Truck className="h-5 w-5 text-green-600" />}
                {template.key === "simple" && <Grid3x3 className="h-5 w-5 text-purple-600" />}
                <span className="font-medium text-gray-900">{template.name}</span>
              </div>
              <p className="text-sm text-gray-600">{template.description}</p>
            </button>
          ))}
        </div>
      </div>
      
      {/* Columns */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Columns</h3>
          <button
            onClick={addColumn}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Column
          </button>
        </div>
        
        {/* Primary Key Warning */}
        {columns.length > 0 && !primaryKeyColumn && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <span className="text-yellow-600">⚠️</span>
            <div className="text-sm">
              <p className="font-medium text-yellow-800">Primary Key Required</p>
              <p className="text-yellow-700 mt-1">
                Please select one column as the primary key by clicking the &quot;Primary&quot; radio button next to a column.
              </p>
            </div>
          </div>
        )}
        
        {columns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No columns yet. Add columns or select a template to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {columns.map((column, index) => (
              <div
                key={column.id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Column Header */}
                <div className="flex items-center gap-3 p-3 bg-gray-50">
                  <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
                  
                  <input
                    type="text"
                    value={column.name}
                    onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                    placeholder="Column name"
                    className="flex-1 px-2 py-1 bg-white border border-gray-300 rounded"
                  />
                  
                  <select
                    value={column.type}
                    onChange={(e) => updateColumn(column.id, { 
                      type: e.target.value as ColumnDefinition["type"],
                      options: e.target.value === "select" ? ["Option 1"] : undefined
                    })}
                    className="px-2 py-1 bg-white border border-gray-300 rounded"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Select</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={column.required}
                      onChange={(e) => updateColumn(column.id, { required: e.target.checked })}
                      className="rounded"
                    />
                    Required
                  </label>
                  
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="primaryKey"
                      checked={primaryKeyColumn === column.key}
                      onChange={() => setPrimaryKeyColumn(column.key)}
                      className="text-blue-600"
                    />
                    <span className={primaryKeyColumn === column.key ? "font-medium text-blue-600" : ""}>
                      Primary{!primaryKeyColumn && <span className="text-red-500 ml-0.5">*</span>}
                    </span>
                  </label>
                  
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveColumn(index, "up")}
                      disabled={index === 0}
                      className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveColumn(index, "down")}
                      disabled={index === columns.length - 1}
                      className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setExpandedColumns(
                        expandedColumns.has(column.id)
                          ? new Set([...expandedColumns].filter(id => id !== column.id))
                          : new Set([...expandedColumns, column.id])
                      )}
                      className="p-1 text-gray-600 hover:text-gray-900"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteColumn(column.id)}
                      className="p-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Expanded Settings */}
                {expandedColumns.has(column.id) && (
                  <div className="p-3 space-y-3 border-t border-gray-200">
                    {/* Field Key */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field Key (for database)
                      </label>
                      <input
                        type="text"
                        value={column.key}
                        onChange={(e) => updateColumn(column.id, { key: e.target.value })}
                        placeholder="field_key"
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </div>
                    
                    {/* Select Options */}
                    {column.type === "select" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Options
                        </label>
                        <div className="space-y-2">
                          {column.options?.map((option, i) => (
                            <div key={i} className="flex gap-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...(column.options || [])];
                                  newOptions[i] = e.target.value;
                                  updateColumn(column.id, { options: newOptions });
                                }}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded"
                              />
                              <button
                                onClick={() => removeOption(column.id, i)}
                                className="px-2 py-1 text-red-600 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addOption(column.id, `Option ${(column.options?.length || 0) + 1}`)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            + Add Option
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* AI Settings */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={column.aiEnabled || false}
                          onChange={(e) => updateColumn(column.id, { aiEnabled: e.target.checked })}
                          className="rounded"
                        />
                        <Zap className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium text-gray-700">Enable AI Extraction</span>
                      </label>
                      
                      {column.aiEnabled && (
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">
                            AI Aliases (alternative names AI should recognize)
                          </label>
                          <div className="space-y-1">
                            {column.aiAliases?.map((alias, i) => (
                              <div key={i} className="flex gap-2">
                                <input
                                  type="text"
                                  value={alias}
                                  onChange={(e) => {
                                    const newAliases = [...(column.aiAliases || [])];
                                    newAliases[i] = e.target.value;
                                    updateColumn(column.id, { aiAliases: newAliases });
                                  }}
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                                />
                                <button
                                  onClick={() => removeAiAlias(column.id, i)}
                                  className="px-2 py-1 text-sm text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addAiAlias(column.id, "")}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              + Add Alias
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={() => router.push("/tracker")}
          className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || columns.length === 0 || !primaryKeyColumn}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !name.trim() ? "Please enter a tracker name" :
            columns.length === 0 ? "Please add at least one column" :
            !primaryKeyColumn ? "Please select a primary key column" :
            ""
          }
        >
          <Save className="h-5 w-5" />
          {saving ? (trackerId ? "Updating..." : "Creating...") : (trackerId ? "Update Tracker" : "Create Tracker")}
        </button>
      </div>
    </div>
  );
}