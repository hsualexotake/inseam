"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  Home,
  FolderOpen,
  CheckSquare,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  Package,
  ArrowLeft,
  Download
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { exportTrackerToCSV } from "@/lib/csv-utils";
import { Logo, LogoIcon } from "@/components/dashboard/LogoComponents";
import { useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import TrackerTable from "@/components/tracker/TrackerTable";
import Link from "next/link";

export default function TrackerViewPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  // Fetch tracker and data - Convex handles real-time updates automatically
  const tracker = useQuery(api.trackers.getTracker, { slug });
  const trackerData = useQuery(
    api.trackers.getTrackerData,
    tracker ? { trackerId: tracker._id, paginationOpts: { numItems: 1000, cursor: null } } : "skip"
  );


  // Export to CSV function
  const handleExportCSV = () => {
    if (!tracker || !trackerData) return;
    exportTrackerToCSV(tracker.slug, tracker.columns, trackerData.page);
  };

  const links = [
    {
      label: "Home",
      href: "/dashboard",
      icon: (
        <Home className="text-gray-600 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Tracker",
      href: "/tracker",
      icon: (
        <Package className="text-gray-600 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Projects",
      href: "/projects",
      icon: (
        <FolderOpen className="text-gray-600 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Tasks",
      href: "/tasks",
      icon: (
        <CheckSquare className="text-gray-600 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Team",
      href: "/team",
      icon: (
        <Users className="text-gray-600 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Settings",
      href: "/settings",
      icon: (
        <Settings className="text-gray-600 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  const bottomLinks = [
    {
      label: "Help & information",
      href: "/help",
      icon: (
        <HelpCircle className="text-gray-600 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  return (
    <div className={cn(
      "flex h-screen bg-gray-50 w-full",
    )}>
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>
          <div>
            <div className="flex flex-col gap-2">
              {bottomLinks.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
              <button
                onClick={() => signOut()}
                className="flex items-center justify-start gap-2 group/sidebar py-2"
              >
                <LogOut className="text-gray-600 h-5 w-5 flex-shrink-0" />
                <motion.span
                  animate={{
                    display: open ? "inline-block" : "none",
                    opacity: open ? 1 : 0,
                  }}
                  className="text-gray-600 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
                >
                  Log out
                </motion.span>
              </button>
            </div>
          </div>
        </SidebarBody>
      </Sidebar>
      
      <main className="flex-1 flex flex-col bg-white rounded-tl-2xl border border-gray-200">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 pt-8">
            {/* Breadcrumb */}
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Link
                href="/tracker"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Trackers
              </Link>
            </motion.div>
            
            {/* Content */}
            {!tracker && !trackerData && (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-gray-500">Loading tracker...</div>
              </div>
            )}
            
            {tracker && !trackerData && (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-gray-500">Loading data...</div>
              </div>
            )}
            
            {tracker && trackerData && (
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                {/* Header */}
                <motion.div
                  className="flex justify-between items-start"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
                >
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{tracker.name}</h1>
                    {tracker.description && (
                      <p className="text-gray-600 mt-1">{tracker.description}</p>
                    )}
                  </div>
                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                </motion.div>

                {/* Table */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
                >
                  <TrackerTable
                    tracker={{
                      _id: tracker._id,
                      name: tracker.name,
                      slug: tracker.slug,
                      columns: tracker.columns,
                      primaryKeyColumn: tracker.primaryKeyColumn,
                    }}
                    data={trackerData.page}
                  />
                </motion.div>
              </motion.div>
            )}
            
            {tracker === null && (
              <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <h3 className="text-xl font-semibold text-gray-700">Tracker Not Found</h3>
                <p className="text-gray-500">The tracker you&apos;re looking for doesn&apos;t exist.</p>
                <Link
                  href="/tracker"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Trackers
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}