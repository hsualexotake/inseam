"use client";

import { useState, useEffect } from "react";
import { Search, Package, Truck, CheckCircle, Clock, AlertCircle, ChevronDown } from "lucide-react";
import type { Shipment } from "@/types/dashboard";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  shipped: { label: "Shipped", icon: Package, color: "bg-blue-100 text-blue-800" },
  in_transit: { label: "In Transit", icon: Truck, color: "bg-indigo-100 text-indigo-800" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  delayed: { label: "Delayed", icon: AlertCircle, color: "bg-red-100 text-red-800" },
};

export default function SKUTrackingTable() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  // Mock data
  useEffect(() => {
    const mockShipments: Shipment[] = [
      {
        id: 1,
        sku_id: 1,
        tracking_number: "1234567890",
        supplier: "Innnox",
        status: "in_transit",
        quantity: 50,
        shipped_date: "2025-08-28",
        expected_delivery: "2025-09-05",
        actual_delivery: null,
        notes: "SKU001 shipped, expected to arrive 9/5/25",
        sku: {
          id: 1,
          sku_code: "SS26-DRS-001-BLK-S",
          product_name: "Summer Midi Dress",
          category: "Dresses",
          color: "Black",
          size: "S",
          season: "SS26",
        },
      },
      {
        id: 2,
        sku_id: 2,
        tracking_number: null,
        supplier: "Innnox",
        status: "pending",
        quantity: 75,
        shipped_date: null,
        expected_delivery: "2025-09-10",
        actual_delivery: null,
        notes: "Color change for SKU002 from Navy to Black",
        sku: {
          id: 2,
          sku_code: "SS26-JKT-002-NVY-M",
          product_name: "Linen Blazer",
          category: "Jackets",
          color: "Navy",
          size: "M",
          season: "SS26",
        },
      },
      {
        id: 3,
        sku_id: 3,
        tracking_number: "9876543210",
        supplier: "Innnox",
        status: "delayed",
        quantity: 100,
        shipped_date: "2025-08-20",
        expected_delivery: "2025-08-27",
        actual_delivery: null,
        notes: "Fabric order SS27 delayed by 2 weeks",
        sku: {
          id: 3,
          sku_code: "FW25-PNT-003-GRY-L",
          product_name: "Wool Trousers",
          category: "Pants",
          color: "Grey",
          size: "L",
          season: "FW25",
        },
      },
      {
        id: 4,
        sku_id: 4,
        tracking_number: "5555666677",
        supplier: "Innnox",
        status: "delivered",
        quantity: 30,
        shipped_date: "2025-08-15",
        expected_delivery: "2025-08-22",
        actual_delivery: "2025-08-22",
        notes: "Delivered on time",
        sku: {
          id: 4,
          sku_code: "FW25-SWT-004-BLU-XL",
          product_name: "Cashmere Sweater",
          category: "Sweaters",
          color: "Blue",
          size: "XL",
          season: "FW25",
        },
      },
    ];
    setShipments(mockShipments);
    setFilteredShipments(mockShipments);
  }, []);

  // Filter shipments
  useEffect(() => {
    let filtered = shipments;

    if (searchTerm) {
      filtered = filtered.filter(
        (shipment) =>
          shipment.sku.sku_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          shipment.sku.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          shipment.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((shipment) => shipment.status === statusFilter);
    }

    setFilteredShipments(filtered);
  }, [shipments, searchTerm, statusFilter]);

  const handleUpdateShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsUpdateDialogOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div>
      <div>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">SKU Tracking & Shipments</h2>
          <p className="text-sm text-gray-500">Monitor and update tracking information for all SKU shipments</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search SKU, product, or tracking number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none w-full sm:w-48 px-4 py-2.5 pr-10 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="shipped">Shipped</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="delayed">Delayed</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                SKU Code
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tracking Number
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Expected Delivery
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredShipments.map((shipment) => {
              const statusInfo = statusConfig[shipment.status];
              const StatusIcon = statusInfo.icon;

              return (
                <tr key={shipment.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-gray-900">
                      {shipment.sku.sku_code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {shipment.sku.product_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {shipment.sku.color} • {shipment.sku.size} • {shipment.sku.season}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-gray-600">
                      {shipment.tracking_number || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shipment.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(shipment.expected_delivery)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleUpdateShipment(shipment)}
                      className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg font-medium transition-all"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredShipments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No shipments found matching your criteria.
          </div>
        )}
      </div>

      {/* Update Dialog - Simplified version */}
      {isUpdateDialogOpen && selectedShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Update Shipment</h3>
            <p className="text-sm text-gray-600 mb-4">
              Update tracking for {selectedShipment.sku.sku_code}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue={selectedShipment.tracking_number || ""}
                  placeholder="Enter tracking number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="pending">Pending</option>
                  <option value="shipped">Shipped</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="delayed">Delayed</option>
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsUpdateDialogOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setIsUpdateDialogOpen(false)}
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