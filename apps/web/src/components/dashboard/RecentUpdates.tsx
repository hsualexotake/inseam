"use client";

import { Bell, Package, Truck, CheckCircle, AlertCircle } from "lucide-react";

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
  const updates: Update[] = [
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Recent Updates</h2>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View all →
        </button>
      </div>

      <div className="space-y-4">
        {updates.map((update) => {
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