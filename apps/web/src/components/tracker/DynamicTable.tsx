"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import { 
  ColumnDefinition, 
  TrackerDataRow 
} from "@packages/backend/convex/types/tracker";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X,
  AlertTriangle,
  Download
} from "lucide-react";
import AddRowModal from "./AddRowModal";

interface DynamicTableProps {
  tracker: {
    _id: Id<"trackers">;
    name: string;
    slug: string;
    columns: ColumnDefinition[];
    primaryKeyColumn: string;
  };
  data: TrackerDataRow[];
  onRefresh: () => void;
}

export default function DynamicTable({ tracker, data, onRefresh }: DynamicTableProps) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingRow, setDeletingRow] = useState<string | null>(null);
  
  const updateRow = useMutation(api.trackers.updateRow);
  const deleteRow = useMutation(api.trackers.deleteRow);
  
  // Sort columns by order
  const sortedColumns = [...tracker.columns].sort((a, b) => a.order - b.order);
  
  // Start editing
  const startEdit = (row: TrackerDataRow) => {
    setEditingRow(row.rowId);
    setEditData(row.data);
  };
  
  // Cancel editing
  const cancelEdit = () => {
    setEditingRow(null);
    setEditData({});
  };
  
  // Save edits
  const saveEdit = async (rowId: string) => {
    try {
      await updateRow({
        trackerId: tracker._id,
        rowId,
        updates: editData,
      });
      setEditingRow(null);
      setEditData({});
      onRefresh();
    } catch (error) {
      console.error("Failed to update row:", error);
      alert("Failed to update row. Please check your data and try again.");
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
      onRefresh();
    } catch (error) {
      console.error("Failed to delete row:", error);
      alert("Failed to delete row. Please try again.");
    } finally {
      setDeletingRow(null);
    }
  };
  
  // Format cell value for display
  const formatCellValue = (value: any, type: ColumnDefinition["type"]) => {
    if (value === null || value === undefined) return "—";
    
    switch (type) {
      case "date":
        return new Date(value).toLocaleDateString();
      case "boolean":
        return value ? "✓" : "✗";
      case "number":
        return Number(value).toLocaleString();
      default:
        return String(value);
    }
  };
  
  // Render cell input for editing
  const renderCellInput = (column: ColumnDefinition, value: any) => {
    const commonProps = {
      value: value || "",
      onChange: (e: any) => setEditData({ 
        ...editData, 
        [column.key]: column.type === "boolean" ? e.target.checked : e.target.value 
      }),
      className: "w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500",
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
            checked={value || false}
            onChange={commonProps.onChange}
            className="w-4 h-4"
          />
        );
      
      case "date":
        return (
          <input
            type="date"
            {...commonProps}
            value={value ? new Date(value).toISOString().split('T')[0] : ""}
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
      {/* Temporary Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-yellow-900">Temporary View</h3>
          <p className="text-sm text-yellow-700 mt-1">
            This is a temporary interface for testing. A proper spreadsheet component will replace this view.
          </p>
        </div>
      </div>
      
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
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {sortedColumns.map(column => (
                <th
                  key={column.id}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                  style={{ minWidth: column.width || 120 }}
                >
                  {column.name}
                  {column.required && <span className="text-red-500 ml-1">*</span>}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
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
                const isEditing = editingRow === row.rowId;
                const isDeleting = deletingRow === row.rowId;
                
                return (
                  <tr key={row._id} className={`hover:bg-gray-50 ${isDeleting ? "opacity-50" : ""}`}>
                    {sortedColumns.map(column => (
                      <td key={column.id} className="px-4 py-3 text-sm text-gray-900">
                        {isEditing ? (
                          renderCellInput(column, editData[column.key])
                        ) : (
                          formatCellValue(row.data[column.key], column.type)
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveEdit(row.rowId)}
                            className="p-1 text-green-600 hover:text-green-700"
                            title="Save"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-gray-600 hover:text-gray-700"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(row)}
                            className="p-1 text-blue-600 hover:text-blue-700"
                            title="Edit"
                            disabled={isDeleting}
                          >
                            <Edit2 className="h-4 w-4" />
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
                      )}
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
            onRefresh();
          }}
        />
      )}
    </div>
  );
}