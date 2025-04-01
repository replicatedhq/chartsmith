"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminProtection } from "@/components/AdminProtection";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Helper function to determine if a link is active
  const isActive = (path: string) => {
    return pathname === path;
  };
  
  // Generate link class name based on active state
  const getLinkClassName = (path: string) => {
    return `flex items-center py-2 px-4 rounded-md ${
      isActive(path) 
        ? "bg-primary text-primary-foreground font-medium" 
        : "hover:bg-border/30 text-text"
    } transition-colors duration-200`;
  };

  return (
    <AdminProtection>
      <div className="flex min-h-screen bg-app">
        {/* Admin sidebar navigation */}
        <aside className="w-64 border-r border-border bg-surface">
          <div className="p-6 mb-6">
            <h1 className="text-xl font-bold text-text">Admin Dashboard</h1>
          </div>
          
          <nav className="px-4">
            <ul className="space-y-2">
              <li>
                <Link 
                  href="/admin" 
                  className={getLinkClassName("/admin")}
                >
                  <span className="mr-3">📊</span> 
                  Dashboard
                </Link>
              </li>
              <li>
                <Link 
                  href="/admin/users" 
                  className={getLinkClassName("/admin/users")}
                >
                  <span className="mr-3">👥</span> 
                  Users
                </Link>
              </li>
              <li>
                <Link 
                  href="/admin/waitlist" 
                  className={getLinkClassName("/admin/waitlist")}
                >
                  <span className="mr-3">⏱️</span> 
                  Waitlist
                </Link>
              </li>
              <li>
                <Link 
                  href="/admin/workspaces" 
                  className={getLinkClassName("/admin/workspaces")}
                >
                  <span className="mr-3">📁</span> 
                  Workspaces
                </Link>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main content area */}
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
      </div>
    </AdminProtection>
  );
}