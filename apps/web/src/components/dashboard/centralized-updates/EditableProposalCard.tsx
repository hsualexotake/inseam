"use client";

import { useState } from "react";
import { CheckCircle, Key, AlertCircle } from "lucide-react";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import TrackerSelector from "./TrackerSelector";
import ColumnMappingDropdown from "./ColumnMappingDropdown";
import EditableValue from "./EditableValue";

interface ColumnUpdate {
  columnKey: string;
  columnName: string;
  columnType: string;
  currentValue?: string | number | boolean | null;
  proposedValue: string | number | boolean | null;
  confidence: number;
}

interface TrackerProposal {
  trackerId: Id<"trackers">;
  trackerName: string;
  rowId: string;
  isNewRow: boolean;
  columnUpdates: ColumnUpdate[];
}

interface EditableProposalCardProps {
  proposal: TrackerProposal;
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
  onApply: (editedProposal: {
    trackerId: Id<"trackers">;
    rowId: string;
    editedColumns: Array<{
      columnKey: string;
      newValue: string | number | boolean | null;
      targetColumnKey?: string;
    }>;
  }) => void;
  onDiscard: () => void;
  isProcessing?: boolean;
}

export default function EditableProposalCard({
  proposal,
  availableTrackers,
  onApply,
  onDiscard,
  isProcessing = false,
}: EditableProposalCardProps) {
  const [selectedTrackerId, setSelectedTrackerId] = useState(proposal.trackerId);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [isApproved, setIsApproved] = useState(false);

  const selectedTracker = availableTrackers.find(t => t._id === selectedTrackerId);

  const handleValueChange = (columnKey: string, newValue: any) => {
    setEditedValues(prev => ({
      ...prev,
      [columnKey]: newValue,
    }));
  };

  const handleColumnMappingChange = (originalKey: string, targetKey: string) => {
    setColumnMappings(prev => ({
      ...prev,
      [originalKey]: targetKey,
    }));
  };

  const handleApply = () => {
    const editedColumns = proposal.columnUpdates.map(update => ({
      columnKey: update.columnKey,
      newValue: editedValues[update.columnKey] ?? update.proposedValue,
      targetColumnKey: columnMappings[update.columnKey],
    }));

    onApply({
      trackerId: selectedTrackerId,
      rowId: proposal.rowId,
      editedColumns,
    });
    setIsApproved(true);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600";
    if (confidence >= 0.7) return "text-yellow-600";
    return "text-orange-600";
  };

  if (isApproved) {
    return (
      <div className="bg-white rounded-lg border border-green-200 p-4">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-5 w-5" />
          <span className="font-medium">Approved</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${isProcessing ? "opacity-50" : ""}`}>
      <div className="p-4">
        <div className="mb-3">
          <TrackerSelector
            trackers={availableTrackers}
            selectedTrackerId={selectedTrackerId}
            onTrackerChange={setSelectedTrackerId}
            disabled={isProcessing}
          />
        </div>

        <div className="space-y-3 mt-4">
              {proposal.columnUpdates.map((update) => {
                const targetColumnKey = columnMappings[update.columnKey] || update.columnKey;
                const currentValue = editedValues[update.columnKey] ?? update.proposedValue;
                const isPrimaryKey = selectedTracker?.primaryKeyColumn === targetColumnKey;

                return (
                  <div key={update.columnKey} className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-3">
                        <ColumnMappingDropdown
                          currentColumnKey={update.columnKey}
                          currentColumnName={update.columnName}
                          selectedColumnKey={targetColumnKey}
                          availableColumns={selectedTracker?.columns || []}
                          onColumnChange={(newKey) => handleColumnMappingChange(update.columnKey, newKey)}
                          disabled={isProcessing}
                        />

                        <span className="text-gray-400">→</span>

                        <EditableValue
                          value={currentValue}
                          type={update.columnType}
                          onChange={(newValue) => handleValueChange(update.columnKey, newValue)}
                          disabled={isProcessing}
                        />

                        <div className="flex items-center gap-2">
                          {isPrimaryKey && (
                            <div className="flex items-center gap-1" title="Primary Key - Must be unique">
                              <Key className="h-3.5 w-3.5 text-amber-600" />
                              <span className="text-xs text-amber-600 font-medium">PK</span>
                            </div>
                          )}
                          <span className={`text-xs ${getConfidenceColor(update.confidence)}`}>
                            ({Math.round(update.confidence * 100)}% conf)
                          </span>
                        </div>
                      </div>
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

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleApply}
                disabled={isProcessing}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
              >
                Apply Changes
              </button>
              <button
                onClick={onDiscard}
                disabled={isProcessing}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
              >
                Discard
              </button>
            </div>
      </div>
    </div>
  );
}