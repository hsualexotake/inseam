"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import {
  ColumnDefinition,
  TrackerDataRow
} from "@packages/backend/convex/types/tracker";
import {
  Plus,
  Trash2,
  Tag,
  MoreVertical
} from "lucide-react";
import AliasManagementModal from "./AliasManagementModal";
import { cn } from "@/lib/utils";
import { ColumnHeader } from "./ColumnPopover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TrackerTableProps {
  tracker: {
    _id: Id<"trackers">;
    name: string;
    slug: string;
    columns: ColumnDefinition[];
    primaryKeyColumn: string;
  };
  data: TrackerDataRow[];
}

// Row Actions Dropdown Component
const RowActionsDropdown = ({
  row,
  tracker,
  isDeleting,
  onDelete,
  onAliasManage
}: {
  row: TrackerDataRow;
  tracker: TrackerTableProps['tracker'];
  isDeleting: boolean;
  onDelete: (rowId: string) => void;
  onAliasManage: (data: { trackerId: Id<"trackers">; rowId: string; primaryKeyValue: string }) => void;
}) => (
  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity z-10">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1.5 rounded-md hover:bg-gray-100 bg-white shadow-sm border transition-colors"
          disabled={isDeleting}
        >
          <MoreVertical className="h-4 w-4 text-gray-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => onAliasManage({
            trackerId: tracker._id,
            rowId: row.rowId,
            primaryKeyValue: String(row.data[tracker.primaryKeyColumn] || row.rowId)
          })}
          className="cursor-pointer"
        >
          <Tag className="h-4 w-4 mr-2" />
          Manage Aliases
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(row.rowId)}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export default function TrackerTable({ tracker, data }: TrackerTableProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string | number | boolean | null>(null);
  const [deletingRow, setDeletingRow] = useState<string | null>(null);
  const [showAliasModal, setShowAliasModal] = useState<{
    trackerId: Id<"trackers">;
    rowId: string;
    primaryKeyValue: string;
  } | null>(null);

  // New state for inline row addition
  const [showEmptyRow, setShowEmptyRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string | number | boolean>>({});
  const [newRowErrors, setNewRowErrors] = useState<Record<string, string>>({});
  const [savingNewRow, setSavingNewRow] = useState(false);

  const updateRow = useMutation(api.trackers.updateRow);
  const deleteRow = useMutation(api.trackers.deleteRow);
  const addRow = useMutation(api.trackers.addRow);

  // Get alias counts for all rows
  const allAliases = useQuery(api.trackerAliases.getAllTrackerAliases, {
    trackerId: tracker._id
  });

  // Calculate alias counts per row
  const aliasCounts = useMemo(() => {
    if (!allAliases) return {};
    return Object.entries(allAliases).reduce((acc, [rowId, aliases]) => {
      acc[rowId] = aliases.length;
      return acc;
    }, {} as Record<string, number>);
  }, [allAliases]);

  // Sort columns by order
  const sortedColumns = [...tracker.columns].sort((a, b) => a.order - b.order);

  // Helper: Validate row data
  const validateRowData = (
    columns: ColumnDefinition[],
    rowData: Record<string, any>
  ): Record<string, string> => {
    const errors: Record<string, string> = {};
    for (const column of columns) {
      if (column.required && !rowData[column.key]) {
        errors[column.key] = `${column.name} is required`;
      }
      if (column.type === "number" && rowData[column.key] && isNaN(Number(rowData[column.key]))) {
        errors[column.key] = `${column.name} must be a number`;
      }
    }
    return errors;
  };

  // Helper: Reset new row state
  const resetNewRowState = () => {
    setShowEmptyRow(false);
    setNewRowData({});
    setNewRowErrors({});
  };

  // Start editing a cell
  const startCellEdit = (rowId: string, columnKey: string, currentValue: string | number | boolean | null) => {
    setEditingCell({ rowId, columnKey });
    setEditValue(currentValue);
  };

  // Save cell edit
  const saveCellEdit = async () => {
    if (!editingCell) return;

    try {
      await updateRow({
        trackerId: tracker._id,
        rowId: editingCell.rowId,
        updates: { [editingCell.columnKey]: editValue },
      });
      setEditingCell(null);
      setEditValue(null);
    } catch (error) {
      console.error("Failed to update cell:", error);
      alert("Failed to update cell. Please check your data and try again.");
    }
  };

  // Cancel cell edit
  const cancelCellEdit = () => {
    setEditingCell(null);
    setEditValue(null);
  };

  // Handle keyboard events in cells
  const handleCellKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await saveCellEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelCellEdit();
    }
  };

  // Delete row
  const handleDelete = async (rowId: string) => {
    if (!confirm("Are you sure you want to delete this row?")) {
      return;
    }

    setDeletingRow(rowId);
    try {
      await deleteRow({
        trackerId: tracker._id,
        rowId,
      });
    } catch (error) {
      console.error("Failed to delete row:", error);
      alert("Failed to delete row. Please try again.");
    } finally {
      setDeletingRow(null);
    }
  };

  // Format cell value for display
  const formatCellValue = (value: any, type: ColumnDefinition["type"]) => {
    if (value === null || value === undefined) return "-";

    switch (type) {
      case "date":
        return new Date(value).toLocaleDateString();
      case "boolean":
        return value ? "Yes" : "No";
      case "number":
        return Number(value).toLocaleString();
      default:
        return String(value);
    }
  };

  // Unified input renderer for both edit and new row
  const renderInput = (
    column: ColumnDefinition,
    value: any,
    onChange: (value: any) => void,
    options?: {
      onKeyDown?: (e: React.KeyboardEvent) => void;
      onBlur?: () => void;
      autoFocus?: boolean;
      error?: string;
      placeholder?: string;
      className?: string;
    }
  ) => {
    const {
      onKeyDown,
      onBlur,
      autoFocus = false,
      error,
      placeholder,
      className = "flex-1 px-2 py-0.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
    } = options || {};

    const baseProps = {
      value: column.type === "boolean" ? (value || false) : (value || ""),
      onChange: (e: any) => onChange(column.type === "boolean" ? e.target.checked : e.target.value),
      onKeyDown,
      onBlur,
      autoFocus,
      className: error ? className.replace("border-gray-300", "border-red-500") : className
    };

    let input;

    switch (column.type) {
      case "select":
        input = (
          <select {...baseProps}>
            <option value="">Select...</option>
            {column.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
        break;

      case "boolean":
        input = (
          <input
            type="checkbox"
            checked={baseProps.value}
            onChange={baseProps.onChange}
            className="w-4 h-4"
          />
        );
        break;

      case "date":
        input = (
          <input
            type="date"
            {...baseProps}
            value={value ? new Date(value).toISOString().split('T')[0] : ""}
          />
        );
        break;

      case "number":
        input = (
          <input
            type="number"
            {...baseProps}
            placeholder={placeholder}
          />
        );
        break;

      default:
        input = (
          <input
            type="text"
            {...baseProps}
            placeholder={placeholder || `Enter ${column.name.toLowerCase()}`}
          />
        );
    }

    if (error) {
      return (
        <div className="w-full">
          {input}
          <p className="text-xs text-red-500 mt-1">{error}</p>
        </div>
      );
    }

    return input;
  };

  // Render cell input for new row
  const renderNewRowInput = (column: ColumnDefinition) => {
    const value = newRowData[column.key];
    const error = newRowErrors[column.key];

    return renderInput(
      column,
      value,
      (newValue) => {
        setNewRowData({ ...newRowData, [column.key]: newValue });
        if (error) {
          setNewRowErrors({ ...newRowErrors, [column.key]: "" });
        }
      },
      {
        error,
        className: `flex-1 px-2 py-0.5 text-sm border ${error ? "border-red-500" : "border-gray-300"} rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`
      }
    );
  };

  // Render cell input for editing
  const renderCellInput = (column: ColumnDefinition) => {
    return renderInput(
      column,
      editValue,
      setEditValue,
      {
        onKeyDown: handleCellKeyDown,
        onBlur: saveCellEdit,
        autoFocus: true,
        className: "flex-1 px-2 py-0.5 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      }
    );
  };

  // Handle save new row
  const handleSaveNewRow = async () => {
    // Validate required fields
    const errors = validateRowData(tracker.columns, newRowData);
    if (Object.keys(errors).length > 0) {
      setNewRowErrors(errors);
      return;
    }

    setSavingNewRow(true);
    try {
      await addRow({
        trackerId: tracker._id,
        data: newRowData,
      });

      // Reset state on success
      resetNewRowState();
    } catch (error) {
      console.error("Failed to add row:", error);
      alert("Failed to add row. Please check your data and try again.");
    } finally {
      setSavingNewRow(false);
    }
  };

  // Handle cancel new row
  const handleCancelNewRow = () => {
    resetNewRowState();
  };

  // Start a new row for inline editing
  const startNewRow = () => {
    setShowEmptyRow(true);
    setNewRowData({});
    setNewRowErrors({});
  };

  return (
    <div>
      {/* Table */}
      <div className={cn(
        "overflow-auto rounded-xl border bg-white",
        "max-w-full"
      )}>
        <table className="w-full table-fixed whitespace-nowrap text-sm text-gray-600">
          <thead className="border-b bg-gray-50">
            <tr>
              {/* Row number header */}
              <th className="w-12 p-2 text-center font-semibold text-gray-500 uppercase tracking-wider text-xs border-r">

              </th>
              {sortedColumns.map(column => (
                <th
                  key={column.id}
                  className="p-4 text-left font-semibold text-gray-700 uppercase tracking-wider text-sm border-l first:border-l-0"
                  style={{ minWidth: column.width || 120 }}
                >
                  <ColumnHeader
                    column={column}
                    isPrimaryKey={column.key === tracker.primaryKeyColumn}
                    trackerId={tracker._id}
                    required={column.required}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={sortedColumns.length + 1}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No data yet. Click &quot;Add Row&quot; to get started.
                </td>
              </tr>
            ) : (
              <>
                {data.map((row, index) => {
                  const isDeleting = deletingRow === row.rowId;

                  return (
                    <tr key={row._id} className={cn(
                      "border-b last:border-0 hover:bg-gray-50 group relative",
                      isDeleting && "opacity-50"
                    )}>
                      {/* Row number */}
                      <td className="w-12 p-2 text-center text-gray-500 border-r text-xs font-medium">
                        {index + 1}
                      </td>
                      {sortedColumns.map((column, columnIndex) => {
                        const isEditingThisCell = editingCell?.rowId === row.rowId && editingCell?.columnKey === column.key;
                        const isLastColumn = columnIndex === sortedColumns.length - 1;

                        return (
                          <td
                            key={column.id}
                            className={cn(
                              "p-4 border-l first:border-l-0",
                              !isEditingThisCell && "cursor-pointer hover:bg-gray-100 transition-colors",
                              isLastColumn && "relative pr-12"
                            )}
                            onClick={() => {
                              if (!isEditingThisCell && !isDeleting) {
                                startCellEdit(row.rowId, column.key, row.data[column.key]);
                              }
                            }}
                          >
                            <div className="inline-flex flex-row items-center gap-2">
                              {isEditingThisCell ? (
                                column.key === tracker.primaryKeyColumn ? (
                                  <>
                                    {renderCellInput(column)}
                                    {aliasCounts[row.rowId] > 0 && (
                                      <span
                                        className="inline-flex items-center gap-0.5 text-gray-500"
                                        title={`${aliasCounts[row.rowId]} alias${aliasCounts[row.rowId] > 1 ? 'es' : ''}`}
                                      >
                                        <Tag className="h-3 w-3" />
                                        <span className="text-xs font-medium">{aliasCounts[row.rowId]}</span>
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  renderCellInput(column)
                                )
                              ) : (
                                <>
                                  {column.key === tracker.primaryKeyColumn ? (
                                    <>
                                      <span className="text-gray-900">
                                        {formatCellValue(row.data[column.key], column.type)}
                                      </span>
                                      {aliasCounts[row.rowId] > 0 && (
                                        <span
                                          className="inline-flex items-center gap-0.5 text-gray-500 hover:text-gray-700 transition-colors cursor-help"
                                          title={`${aliasCounts[row.rowId]} alias${aliasCounts[row.rowId] > 1 ? 'es' : ''}`}
                                        >
                                          <Tag className="h-3 w-3" />
                                          <span className="text-xs font-medium">{aliasCounts[row.rowId]}</span>
                                        </span>
                                      )}
                                    </>
                                  ) : column.type === "date" && row.data[column.key] ? (
                                    <code className="rounded-md bg-gray-100 p-1 text-gray-700">
                                      {formatCellValue(row.data[column.key], column.type)}
                                    </code>
                                  ) : (
                                    <span className="text-gray-900">
                                      {formatCellValue(row.data[column.key], column.type)}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            {/* Actions dropdown - positioned absolutely within last column */}
                            {isLastColumn && (
                              <RowActionsDropdown
                                row={row}
                                tracker={tracker}
                                isDeleting={isDeleting}
                                onDelete={handleDelete}
                                onAliasManage={setShowAliasModal}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Empty row for adding new data */}
                {showEmptyRow && (
                  <tr className="border-b">
                    {/* Row number for new row */}
                    <td className="w-12 p-2 text-center text-gray-500 border-r text-xs font-medium">
                      {data.length + 1}
                    </td>
                    {sortedColumns.map((column, columnIndex) => {
                      const isLastColumn = columnIndex === sortedColumns.length - 1;

                      return (
                        <td key={column.id} className={cn(
                          "p-4 border-l first:border-l-0",
                          isLastColumn && "relative pr-24"
                        )}>
                          {renderNewRowInput(column)}
                          {/* Actions for new row - positioned absolutely within last column */}
                          {isLastColumn && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                              <div className="flex gap-1">
                                <button
                                  onClick={handleSaveNewRow}
                                  disabled={savingNewRow}
                                  className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Save"
                                >
                                  {savingNewRow ? "..." : "✓"}
                                </button>
                                <button
                                  onClick={handleCancelNewRow}
                                  disabled={savingNewRow}
                                  className="px-2 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
                                  title="Cancel"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Subtle add row button below table */}
      {!showEmptyRow && data.length > 0 && (
        <div className="flex justify-center mt-3">
          <button
            onClick={startNewRow}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors bg-white"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>
        </div>
      )}

      {/* Add Row Modal - Removed in favor of inline editing */}

      {/* Alias Management Modal */}
      {showAliasModal && (
        <AliasManagementModal
          trackerId={showAliasModal.trackerId}
          rowId={showAliasModal.rowId}
          primaryKeyValue={showAliasModal.primaryKeyValue}
          onClose={() => setShowAliasModal(null)}
        />
      )}
    </div>
  );
}