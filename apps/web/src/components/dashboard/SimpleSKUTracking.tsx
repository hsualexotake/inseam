"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Search, Package, Truck, CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  shipped: { label: "Shipped", icon: Package, color: "bg-blue-100 text-blue-800" },
  in_transit: { label: "In Transit", icon: Truck, color: "bg-indigo-100 text-indigo-800" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  delayed: { label: "Delayed", icon: AlertCircle, color: "bg-red-100 text-red-800" },
};

export default function SimpleSKUTracking() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSKU, setSelectedSKU] = useState<any>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Fetch SKUs from database - simple query, no transformation
  const skuData = useQuery(api.tracking.getAllSKUs, { limit: 100 });
  const initializeSampleData = useMutation(api.tracking.initializeSampleSKUs);
  const updateSKU = useMutation(api.tracking.updateSKU);
  
  // Handle sample data initialization
  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      await initializeSampleData({});
    } catch (error) {
      console.error("Failed to initialize:", error);
    } finally {
      setIsInitializing(false);
    }
  };
  
  // Simple inline filtering - no useEffect needed
  const filteredData = skuData?.filter(sku => {
    const matchesSearch = !searchTerm || 
      sku.skuCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sku.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sku.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || sku.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];
  
  const handleUpdateSKU = async (updates: any) => {
    if (!selectedSKU) return;
    
    try {
      await updateSKU({
        skuCode: selectedSKU.skuCode,
        updates,
      });
      setIsUpdateDialogOpen(false);
      setSelectedSKU(null);
    } catch (error) {
      console.error("Failed to update SKU:", error);
    }
  };
  
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    return dateString; // Already stored as readable string
  };
  
  const getConfidenceIndicator = (confidence?: number) => {
    if (!confidence) return null;
    const color = confidence >= 0.8 ? "text-green-500" : confidence >= 0.5 ? "text-yellow-500" : "text-red-500";
    return (
      <span className={`text-xs ${color}`} title={`Confidence: ${(confidence * 100).toFixed(0)}%`}>
        ●
      </span>
    );
  };

  // Loading state
  if (skuData === undefined) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">
          Loading SKU tracking data...
        </div>
      </div>
    );
  }

  // Empty state
  if (skuData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center space-y-4">
          <Package className="h-12 w-12 text-gray-400 mx-auto" />
          <p className="text-gray-500">No SKU data available yet</p>
          <button
            onClick={handleInitialize}
            disabled={isInitializing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isInitializing ? 'animate-spin' : ''}`} />
            {isInitializing ? "Initializing..." : "Load Sample Data"}
          </button>
          <p className="text-xs text-gray-400">
            SKUs will be added automatically when you process emails
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">SKU Tracking</h2>
        <p className="text-sm text-gray-500">Real-time tracking information from email updates</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search SKU, product, or tracking..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="shipped">Shipped</option>
          <option value="in_transit">In Transit</option>
          <option value="delivered">Delivered</option>
          <option value="delayed">Delayed</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                SKU Code
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                Product
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                Tracking
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                Delivery
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                Source
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No SKUs match your filters
                </td>
              </tr>
            ) : (
              filteredData.map((sku) => {
                const status = sku.status || "pending";
                const statusInfo = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
                const StatusIcon = statusInfo.icon;

                return (
                  <tr key={sku._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-900">
                        {sku.skuCode}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {sku.productName}
                        </div>
                        {sku.category && (
                          <div className="text-xs text-gray-500">
                            {sku.category}
                            {sku.color && ` • ${sku.color}`}
                            {sku.size && ` • ${sku.size}`}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-600">
                        {sku.trackingNumber || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(sku.deliveryDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {getConfidenceIndicator(sku.lastUpdateConfidence)}
                        <span className="text-xs text-gray-500">
                          {sku.lastUpdatedFrom === "manual" ? "Manual" : "Email"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedSKU(sku);
                          setIsUpdateDialogOpen(true);
                        }}
                        className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg font-medium transition-all"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Simple Update Dialog */}
      {isUpdateDialogOpen && selectedSKU && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Update {selectedSKU.skuCode}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  id="tracking-input"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  defaultValue={selectedSKU.trackingNumber || ""}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select 
                  id="status-select"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  defaultValue={selectedSKU.status || "pending"}
                >
                  <option value="pending">Pending</option>
                  <option value="shipped">Shipped</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="delayed">Delayed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Date
                </label>
                <input
                  type="text"
                  id="delivery-input"
                  placeholder="e.g., 2025-09-15"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  defaultValue={selectedSKU.deliveryDate || ""}
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsUpdateDialogOpen(false);
                    setSelectedSKU(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const trackingInput = document.getElementById('tracking-input') as HTMLInputElement;
                    const statusSelect = document.getElementById('status-select') as HTMLSelectElement;
                    const deliveryInput = document.getElementById('delivery-input') as HTMLInputElement;
                    
                    handleUpdateSKU({
                      trackingNumber: trackingInput?.value || undefined,
                      status: statusSelect?.value || undefined,
                      deliveryDate: deliveryInput?.value || undefined,
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}