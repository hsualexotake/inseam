import MinimalSidebar from "@/components/dashboard/MinimalSidebar";
import ModernHeader from "@/components/dashboard/ModernHeader";
import MetricCards from "@/components/dashboard/MetricCards";
import UnifiedUpdates from "@/components/dashboard/UnifiedUpdates";
import SimpleSKUTracking from "@/components/dashboard/SimpleSKUTracking";

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-white">
      <MinimalSidebar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          <ModernHeader />
          <MetricCards />
          
          <div className="mb-8">
            <UnifiedUpdates />
          </div>
          
          <SimpleSKUTracking />
        </div>
      </main>
    </div>
  );
}