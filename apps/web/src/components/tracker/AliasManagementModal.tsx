"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import { X, Tag, Trash2, Plus } from "lucide-react";

interface AliasManagementModalProps {
  trackerId: Id<"trackers">;
  rowId: string;
  primaryKeyValue: string;
  onClose: () => void;
}

export default function AliasManagementModal({
  trackerId,
  rowId,
  primaryKeyValue,
  onClose
}: AliasManagementModalProps) {
  const [newAlias, setNewAlias] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query existing aliases
  const aliases = useQuery(api.trackerAliases.getRowAliases, {
    trackerId,
    rowId
  });

  // Mutations
  const addAlias = useMutation(api.trackerAliases.addRowAlias);
  const removeAlias = useMutation(api.trackerAliases.removeRowAlias);

  // Handle add alias
  const handleAddAlias = async () => {
    if (!newAlias.trim()) {
      setError("Alias cannot be empty");
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      await addAlias({
        trackerId,
        rowId,
        alias: newAlias.trim()
      });
      setNewAlias("");
    } catch (err: any) {
      setError(err.message || "Failed to add alias");
    } finally {
      setIsAdding(false);
    }
  };

  // Handle remove alias
  const handleRemoveAlias = async (aliasId: Id<"trackerRowAliases">) => {
    try {
      await removeAlias({ aliasId });
    } catch (err: any) {
      setError(err.message || "Failed to remove alias");
    }
  };

  // Handle enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isAdding) {
      handleAddAlias();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold">
                Aliases for &ldquo;{primaryKeyValue}&rdquo;
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Existing aliases */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Current Aliases ({aliases?.length || 0})
              </h3>

              {aliases && aliases.length > 0 ? (
                <div className="space-y-2">
                  {aliases.map((alias) => (
                    <div
                      key={alias._id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-900">
                        {alias.alias}
                      </span>
                      <button
                        onClick={() => handleRemoveAlias(alias._id)}
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="Remove alias"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No aliases yet. Add one below.
                </p>
              )}
            </div>

            {/* Add new alias */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Add New Alias
              </h3>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter alias (e.g., &lsquo;green dress&rsquo;)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={isAdding}
                />
                <button
                  onClick={handleAddAlias}
                  disabled={isAdding || !newAlias.trim()}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              {/* Error message */}
              {error && (
                <p className="mt-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              {/* Help text */}
              <p className="mt-2 text-xs text-gray-500">
                Aliases help identify this item in emails. For example, if this SKU is &ldquo;12&rdquo;,
                you might add &ldquo;green dress&rdquo; or &ldquo;summer collection item&rdquo; as aliases.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}