"use client";

import React from "react";
import Link from "next/link";
import { AdminProtection } from "@/components/AdminProtection";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
                  href="/admin/users" 
                  className="flex items-center py-2 px-4 rounded-md hover:bg-border/30 text-text"
                >
                  <span className="mr-3">👥</span> 
                  Users
                </Link>
              </li>
              <li>
                <Link 
                  href="/admin/waitlist" 
                  className="flex items-center py-2 px-4 rounded-md hover:bg-border/30 text-text"
                >
                  <span className="mr-3">⏱️</span> 
                  Waitlist
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