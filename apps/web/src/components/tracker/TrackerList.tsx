"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import Link from "next/link";
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Database,
  FileSpreadsheet,
  Package,
  Truck,
  Grid3x3
} from "lucide-react";

const iconMap: Record<string, any> = {
  fashion: Package,
  logistics: Truck,
  simple: Grid3x3,
  default: FileSpreadsheet,
};

export default function TrackerList() {
  const [deletingId, setDeletingId] = useState<Id<"trackers"> | null>(null);
  
  const trackers = useQuery(api.trackers.listTrackers, { activeOnly: true });
  const deleteTracker = useMutation(api.trackers.deleteTracker);
  
  const handleDelete = async (trackerId: Id<"trackers">, trackerName: string) => {
    if (!confirm(`Are you sure you want to delete "${trackerName}"? This will delete all associated data.`)) {
      return;
    }
    
    setDeletingId(trackerId);
    try {
      await deleteTracker({ trackerId });
    } catch (error) {
      console.error("Failed to delete tracker:", error);
      alert("Failed to delete tracker. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };
  
  // Determine icon based on tracker name or template
  const getTrackerIcon = (tracker: any) => {
    const name = tracker.name.toLowerCase();
    if (name.includes("fashion") || name.includes("sku")) return iconMap.fashion;
    if (name.includes("logistics") || name.includes("shipping")) return iconMap.logistics;
    if (name.includes("simple")) return iconMap.simple;
    return iconMap.default;
  };
  
  if (trackers === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading trackers...</div>
      </div>
    );
  }
  
  if (trackers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Database className="h-16 w-16 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-700">No Trackers Yet</h3>
        <p className="text-gray-500 text-center max-w-md">
          Create your first tracker to start managing your data. Choose from templates or build your own.
        </p>
        <Link
          href="/tracker/builder"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Create Your First Tracker
        </Link>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your Trackers</h2>
          <p className="text-gray-600 mt-1">Manage your custom spreadsheets and data</p>
        </div>
        <Link
          href="/tracker/builder"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Tracker
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trackers.map((tracker) => {
          const Icon = getTrackerIcon(tracker);
          const isDeleting = deletingId === tracker._id;
          
          return (
            <div
              key={tracker._id}
              className={`bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow ${
                isDeleting ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex gap-1">
                  <Link
                    href={`/tracker/view/${tracker.slug}`}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/tracker/edit/${tracker._id}`}
                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(tracker._id, tracker.name)}
                    disabled={isDeleting}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {tracker.name}
              </h3>
              
              {tracker.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {tracker.description}
                </p>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {tracker.columns.length} columns
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(tracker.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link
                  href={`/tracker/view/${tracker.slug}`}
                  className="block w-full text-center py-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Open Tracker →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}