"use client";

import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { 
  Home,
  FolderOpen,
  CheckSquare,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  Package
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Logo, LogoIcon } from "@/components/dashboard/LogoComponents";
import { useClerk } from "@clerk/nextjs";
import ModernHeader from "@/components/dashboard/ModernHeader";
import CentralizedUpdates from "@/components/dashboard/CentralizedUpdates";

export default function DashboardPage() {
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);

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
            <ModernHeader />

            <div className="mb-8 mx-auto" style={{ maxWidth: '84rem' }}>
              <CentralizedUpdates />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

