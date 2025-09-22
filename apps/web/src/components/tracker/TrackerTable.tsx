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
  Download,
  Tag
} from "lucide-react";
import AddRowModal from "./AddRowModal";
import AliasManagementModal from "./AliasManagementModal";
import { cn } from "@/lib/utils";
import { ColumnHeader } from "./ColumnPopover";

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

export default function TrackerTable({ tracker, data }: TrackerTableProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnKey: string } | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingRow, setDeletingRow] = useState<string | null>(null);
  const [showAliasModal, setShowAliasModal] = useState<{
    trackerId: Id<"trackers">;
    rowId: string;
    primaryKeyValue: string;
  } | null>(null);

  const updateRow = useMutation(api.trackers.updateRow);
  const deleteRow = useMutation(api.trackers.deleteRow);

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

  // Start editing a cell
  const startCellEdit = (rowId: string, columnKey: string, currentValue: any) => {
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

  // Render cell input for editing
  const renderCellInput = (column: ColumnDefinition) => {
    const commonProps = {
      value: editValue || "",
      onChange: (e: any) => setEditValue(
        column.type === "boolean" ? e.target.checked : e.target.value
      ),
      onKeyDown: handleCellKeyDown,
      onBlur: saveCellEdit,
      autoFocus: true,
      className: "flex-1 px-2 py-0.5 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white",
    };

    switch (column.type) {
      case "select":
        return (
          <select {...commonProps}>
            <option value="">Select...</option>
            {column.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case "boolean":
        return (
          <input
            type="checkbox"
            checked={editValue || false}
            onChange={commonProps.onChange}
            className="w-4 h-4"
          />
        );

      case "date":
        return (
          <input
            type="date"
            {...commonProps}
            value={editValue ? new Date(editValue).toISOString().split('T')[0] : ""}
          />
        );

      case "number":
        return (
          <input
            type="number"
            {...commonProps}
          />
        );

      default:
        return (
          <input
            type="text"
            {...commonProps}
          />
        );
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = sortedColumns.map(col => col.name).join(",");
    const rows = data.map(row =>
      sortedColumns.map(col => {
        const value = row.data[col.key];
        // Escape commas and quotes in values
        const escaped = String(value || "").replace(/"/g, '""');
        return escaped.includes(",") ? `"${escaped}"` : escaped;
      }).join(",")
    );

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tracker.slug}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {data.length} {data.length === 1 ? "row" : "rows"}
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={cn(
        "my-6 overflow-auto rounded-xl border bg-white",
        "max-w-full"
      )}>
        <table className="w-full table-fixed whitespace-nowrap text-sm text-gray-600">
          <thead className="border-b bg-gray-50">
            <tr>
              {sortedColumns.map(column => (
                <th
                  key={column.id}
                  className="p-4 text-left font-semibold text-gray-700 uppercase tracking-wider text-xs border-l first:border-l-0"
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
              <th className="p-4 text-left font-semibold text-gray-700 uppercase tracking-wider text-xs border-l">
                Actions
              </th>
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
              data.map(row => {
                const isDeleting = deletingRow === row.rowId;

                return (
                  <tr key={row._id} className={cn(
                    "border-b last:border-0 hover:bg-gray-50",
                    isDeleting && "opacity-50"
                  )}>
                    {sortedColumns.map(column => {
                      const isEditingThisCell = editingCell?.rowId === row.rowId && editingCell?.columnKey === column.key;

                      return (
                        <td
                          key={column.id}
                          className={cn(
                            "p-4 border-l first:border-l-0",
                            !isEditingThisCell && "cursor-pointer hover:bg-gray-100 transition-colors"
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
                        </td>
                      );
                    })}
                    <td className="p-4 border-l">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setShowAliasModal({
                            trackerId: tracker._id,
                            rowId: row.rowId,
                            primaryKeyValue: String(row.data[tracker.primaryKeyColumn] || row.rowId)
                          })}
                          className="p-1 text-purple-600 hover:text-purple-700"
                          title="Manage Aliases"
                        >
                          <Tag className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(row.rowId)}
                          className="p-1 text-red-600 hover:text-red-700"
                          title="Delete"
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Row Modal */}
      {showAddModal && (
        <AddRowModal
          tracker={tracker}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
          }}
        />
      )}

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