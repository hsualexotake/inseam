"use client";

import { useState } from "react";
import { Plus, X, Key, AlertCircle } from "lucide-react";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import TrackerSelector from "./TrackerSelector";
import ColumnMappingDropdown from "./ColumnMappingDropdown";
import EditableValue from "./EditableValue";

interface ManualProposalCreatorProps {
  availableTrackers: Array<{
    _id: Id<"trackers">;
    name: string;
    columns: Array<{
      id: string;
      key: string;
      name: string;
      type: string;
    }>;
    primaryKeyColumn?: string;
  }>;
  onApply: (proposal: {
    trackerId: Id<"trackers">;
    rowId: string;
    editedColumns: Array<{
      columnKey: string;
      newValue: string | number | boolean | null;
      targetColumnKey?: string;
    }>;
  }) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

interface FieldEntry {
  id: string;
  columnKey: string;
  value: string | number | boolean | null;
}

export default function ManualProposalCreator({
  availableTrackers,
  onApply,
  onCancel,
  isProcessing = false,
}: ManualProposalCreatorProps) {
  // Default to first tracker if available
  const defaultTrackerId = availableTrackers.length > 0 ? availableTrackers[0]._id : null;
  const [selectedTrackerId, setSelectedTrackerId] = useState<Id<"trackers"> | null>(defaultTrackerId);
  const [fields, setFields] = useState<FieldEntry[]>([]);

  const selectedTracker = availableTrackers.find(t => t._id === selectedTrackerId);

  // If no trackers available, show error message
  if (availableTrackers.length === 0 || !selectedTrackerId) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="text-center py-4 text-gray-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="mb-3">No trackers available. Please create a tracker first.</p>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const handleAddField = () => {
    // Find the first column that hasn't been added yet
    const usedColumnKeys = new Set(fields.map(f => f.columnKey));
    const availableColumn = selectedTracker?.columns.find(
      col => !usedColumnKeys.has(col.key)
    );

    if (availableColumn) {
      setFields([
        ...fields,
        {
          id: `field-${Date.now()}`,
          columnKey: availableColumn.key,
          value: null,
        },
      ]);
    }
  };

  const handleRemoveField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const handleColumnChange = (fieldId: string, newColumnKey: string) => {
    setFields(fields.map(f =>
      f.id === fieldId ? { ...f, columnKey: newColumnKey } : f
    ));
  };

  const handleValueChange = (fieldId: string, newValue: any) => {
    setFields(fields.map(f =>
      f.id === fieldId ? { ...f, value: newValue } : f
    ));
  };

  const handleApply = () => {
    if (!selectedTrackerId || fields.length === 0) {
      return;
    }

    // Get primary key value for rowId
    const pkColumn = selectedTracker?.primaryKeyColumn;
    const pkField = fields.find(f => f.columnKey === pkColumn);
    const rowId = pkField?.value?.toString() || `new-${Date.now()}`;

    const editedColumns = fields.map(field => ({
      columnKey: field.columnKey,
      newValue: field.value,
      targetColumnKey: field.columnKey,
    }));

    onApply({
      trackerId: selectedTrackerId,
      rowId,
      editedColumns,
    });
  };

  const canAddMoreFields = selectedTracker && fields.length < selectedTracker.columns.length;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${isProcessing ? "opacity-50" : ""}`}>
      <div className="p-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Tracker
          </label>
          <TrackerSelector
            trackers={availableTrackers}
            selectedTrackerId={selectedTrackerId}
            onTrackerChange={setSelectedTrackerId}
            disabled={isProcessing}
          />
        </div>

        {fields.length > 0 && (
          <div className="space-y-3 mb-4">
            {fields.map((field) => {
              const column = selectedTracker?.columns.find(c => c.key === field.columnKey);
              const isPrimaryKey = selectedTracker?.primaryKeyColumn === field.columnKey;

              return (
                <div key={field.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-3">
                      <ColumnMappingDropdown
                        currentColumnKey={field.columnKey}
                        currentColumnName={column?.name || field.columnKey}
                        selectedColumnKey={field.columnKey}
                        availableColumns={selectedTracker?.columns || []}
                        onColumnChange={(newKey) => handleColumnChange(field.id, newKey)}
                        disabled={isProcessing}
                      />

                      <span className="text-gray-400">→</span>

                      <EditableValue
                        value={field.value}
                        type={column?.type || "text"}
                        onChange={(newValue) => handleValueChange(field.id, newValue)}
                        disabled={isProcessing}
                      />

                      {isPrimaryKey && (
                        <div className="flex items-center gap-1" title="Primary Key - Must be unique">
                          <Key className="h-3.5 w-3.5 text-amber-600" />
                          <span className="text-xs text-amber-600 font-medium">PK</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveField(field.id)}
                      disabled={isProcessing}
                      className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                      title="Remove field"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>

                  {isPrimaryKey && (
                    <div className="flex items-center gap-2 ml-[180px] text-xs text-amber-600">
                      <AlertCircle className="h-3 w-3" />
                      <span>Primary key must be unique in the tracker</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canAddMoreFields && (
          <button
            onClick={handleAddField}
            disabled={isProcessing || !selectedTrackerId}
            className="w-full mb-4 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Field
          </button>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleApply}
            disabled={isProcessing || fields.length === 0 || !selectedTrackerId}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            Apply Changes
          </button>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
