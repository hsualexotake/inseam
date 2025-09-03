import MinimalSidebar from "@/components/dashboard/MinimalSidebar";
import ModernHeader from "@/components/dashboard/ModernHeader";
import MetricCards from "@/components/dashboard/MetricCards";
import ModernEmailSummary from "@/components/dashboard/ModernEmailSummary";
import RecentUpdates from "@/components/dashboard/RecentUpdates";
import SKUTrackingTable from "@/components/dashboard/SKUTrackingTable";

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-white">
      <MinimalSidebar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          <ModernHeader />
          <MetricCards />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <ModernEmailSummary />
            <RecentUpdates />
          </div>
          
          <SKUTrackingTable />
        </div>
      </main>
    </div>
  );
}