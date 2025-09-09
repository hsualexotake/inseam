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
          <h1 className="heading-large">
            Hello, {firstName}
          </h1>
        </div>
        
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-5 h-5" />
          <span className="body-text">{currentDate}</span>
        </div>
      </div>
    </div>
  );
}