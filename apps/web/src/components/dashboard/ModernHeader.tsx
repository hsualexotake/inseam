"use client";

import { Calendar } from "lucide-react";
import { useUser } from "@clerk/nextjs";

export default function ModernHeader() {
  const { user } = useUser();
  const currentDate = new Date().toLocaleDateString('en-US', { 
    day: 'numeric',
    month: 'long', 
    year: 'numeric' 
  });
  
  const firstName = user?.firstName || user?.username || "there";

  return (
    <div className="mb-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Hello, {firstName}
          </h1>
          <p className="text-gray-500 text-lg">
            Track team progress here. You almost reach a goal!
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-5 h-5" />
          <span className="text-sm font-medium">{currentDate}</span>
        </div>
      </div>
    </div>
  );
}