"use client";

import { useQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Bell, Package, Truck, CheckCircle, AlertCircle, Mail } from "lucide-react";

interface Update {
  id: string;
  type: "shipment" | "delivery" | "alert" | "info";
  title: string;
  description: string;
  timestamp: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}

export default function RecentUpdates() {
  // Fetch update logs from database
  const updateLogs = useQuery(api.tracking.getSKUUpdateHistory, { limit: 10 });
  const skus = useQuery(api.tracking.getAllSKUs, { limit: 50 });
  
  // Helper function to map update types to UI format
  const mapUpdateType = (field: string): Update["type"] => {
    if (field === "status" || field === "trackingNumber") return "shipment";
    if (field === "deliveryDate") return "delivery";
    if (field.includes("delay")) return "alert";
    return "info";
  };
  
  // Helper function to get icon and color based on type
  const getUpdateIcon = (type: string, status?: string) => {
    if (status === "delivered") return { icon: CheckCircle, color: "text-green-600 bg-green-50" };
    if (status === "delayed") return { icon: AlertCircle, color: "text-red-600 bg-red-50" };
    if (status === "shipped" || status === "in_transit") return { icon: Truck, color: "text-blue-600 bg-blue-50" };
    if (type.includes("email")) return { icon: Mail, color: "text-purple-600 bg-purple-50" };
    return { icon: Package, color: "text-gray-600 bg-gray-50" };
  };
  
  // Helper function to format time ago
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return "just now";
  };
  
  // Transform database logs to UI format
  const updates: Update[] = updateLogs?.map((log: any, index) => {
    // The log now has: field, oldValue, newValue, timestamp, skuCode (added by getSKUUpdateHistory)
    const sku = skus?.find(s => s.skuCode === log.skuCode);
    const { icon, color } = getUpdateIcon(log.field, log.newValue);
    
    let title = "SKU Update";
    let description = "Update recorded";
    
    if (sku) {
      if (log.field === "status") {
        title = `${sku.skuCode} Status Update`;
        description = `Status changed from ${log.oldValue || 'unknown'} to ${log.newValue}${log.sourceEmailId ? " (from email)" : ""}`;
      } else if (log.field === "trackingNumber") {
        title = `Tracking Added: ${sku.skuCode}`;
        description = `Tracking number ${log.newValue} added`;
      } else if (log.field === "deliveryDate") {
        title = `Delivery Update: ${sku.skuCode}`;
        description = `Delivery date changed to ${log.newValue}`;
      } else if (log.field === "quantity") {
        title = `Quantity Update: ${sku.skuCode}`;
        description = `Quantity changed from ${log.oldValue || '0'} to ${log.newValue}`;
      } else {
        title = `${sku.skuCode} ${log.field} Update`;
        description = `${log.field} changed to ${log.newValue}`;
      }
    }
    
    return {
      id: `update-${index}-${log.timestamp}`,
      type: mapUpdateType(log.field),
      title,
      description,
      timestamp: formatTimeAgo(log.timestamp),
      icon,
      iconColor: color,
    };
  }) || [];
  
  // If no database updates, show default data
  const defaultUpdates: Update[] = [
    {
      id: "1",
      type: "shipment",
      title: "SKU SS26-DRS-001 Shipped",
      description: "Order #1234567890 has been dispatched from warehouse",
      timestamp: "2 hours ago",
      icon: Package,
      iconColor: "text-blue-600 bg-blue-50",
    },
    {
      id: "2",
      type: "delivery",
      title: "FW25-JKT-002 Delivered",
      description: "Successfully delivered to distribution center",
      timestamp: "5 hours ago",
      icon: CheckCircle,
      iconColor: "text-green-600 bg-green-50",
    },
    {
      id: "3",
      type: "alert",
      title: "Delay Alert: SS26-PNT-003",
      description: "Expected delivery delayed by 2 days due to customs",
      timestamp: "1 day ago",
      icon: AlertCircle,
      iconColor: "text-red-600 bg-red-50",
    },
    {
      id: "4",
      type: "info",
      title: "Tracking Update Available",
      description: "New tracking information for 3 shipments",
      timestamp: "2 days ago",
      icon: Truck,
      iconColor: "text-purple-600 bg-purple-50",
    },
    {
      id: "5",
      type: "info",
      title: "Weekly Report Ready",
      description: "Your shipment summary for last week is available",
      timestamp: "3 days ago",
      icon: Bell,
      iconColor: "text-orange-600 bg-orange-50",
    },
  ];
  
  const displayUpdates = updates.length > 0 ? updates : defaultUpdates;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Recent Updates</h2>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View all →
        </button>
      </div>

      <div className="space-y-4">
        {displayUpdates.slice(0, 5).map((update) => {
          const Icon = update.icon;
          
          return (
            <div
              key={update.id}
              className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              <div className={`p-2 rounded-lg ${update.iconColor}`}>
                <Icon className="h-4 w-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 text-sm mb-1">
                  {update.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {update.description}
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  {update.timestamp}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}