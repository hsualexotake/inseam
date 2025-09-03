"use client";

import { ThumbsUp, Clock, TrendingUp } from "lucide-react";

export default function MetricCards() {
  const metrics = [
    {
      title: "Finished",
      value: "18",
      change: "+8 tasks",
      changeType: "positive",
      icon: ThumbsUp,
      iconBg: "bg-gray-100",
    },
    {
      title: "Tracked", 
      value: "31h",
      change: "-6 hours",
      changeType: "negative",
      icon: Clock,
      iconBg: "bg-gray-100",
    },
    {
      title: "Efficiency",
      value: "93%",
      change: "+12%",
      changeType: "positive",
      icon: TrendingUp,
      iconBg: "bg-gray-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        
        return (
          <div key={index} className="bg-white rounded-lg p-5 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div className={`${metric.iconBg} p-2.5 rounded-lg`}>
                <Icon className="w-5 h-5 text-gray-700" />
              </div>
              {metric.changeType === "negative" && (
                <span className="text-red-500 text-2xl">-</span>
              )}
            </div>
            
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">
                {metric.title}
              </p>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-gray-900">
                  {metric.value}
                </span>
                <span className={`text-sm font-medium ${
                  metric.changeType === "positive" 
                    ? "text-green-600" 
                    : "text-red-600"
                }`}>
                  {metric.changeType === "positive" ? "↓" : "↑"} {metric.change}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}