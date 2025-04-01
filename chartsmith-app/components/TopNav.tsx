"use client";
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { CreateChartModal } from "./CreateChartModal";
import { StatusDropdown } from "./StatusDropdown";
import { TtlshModal } from "./TtlshModal";

// Removed evalItems

const exportItems = [{ label: "Push to ttl.sh" }];

export function TopNav() {
  const [isChartDropdownOpen, setIsChartDropdownOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTtlshModal, setShowTtlshModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [workspaceName, setWorkspaceName] = useState("workspace");
  
  // In a real implementation, we would get the workspace name from context or a hook
  useEffect(() => {
    // For now, just get the workspace name from the URL
    const path = window.location.pathname;
    const workspaceMatch = path.match(/\/workspace\/([a-zA-Z0-9-]+)/);
    if (workspaceMatch && workspaceMatch[1]) {
      setWorkspaceName(workspaceMatch[1]);
    }
  }, []);

  const handleMouseEnter = () => {
    setIsChartDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    setIsChartDropdownOpen(false);
  };

  return (
    <>
      <nav className={`h-14 border-b flex items-center justify-between px-4 relative z-50 ${resolvedTheme === "dark" ? "border-dark-border bg-dark-surface" : "border-gray-200 bg-white"}`}>
        <Link href="/" className={`flex items-center space-x-2 min-w-[200px] ${resolvedTheme === "dark" ? "text-white" : "text-gray-900"}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="4" fill="#6a77fb" />
            <path d="M7 7H11V11H7V7Z" fill="white" />
            <path d="M13 7H17V11H13V7Z" fill="white" />
            <path d="M7 13H11V17H7V13Z" fill="white" />
            <path d="M13 13H17V17H13V13Z" fill="white" />
          </svg>
          <div className="flex items-center">
            <span className={`text-lg font-semibold ${resolvedTheme === "dark" ? "text-gray-300" : "text-gray-900"} ml-2`}>ChartSmith</span>
            <span className={`text-xs ${resolvedTheme === "dark" ? "text-gray-400" : "text-gray-500"} ml-2`}>by Replicated</span>
          </div>
        </Link>

        <div className="flex-1 flex justify-center">
          <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} ref={dropdownRef}>
            <button className={`px-3 py-1.5 text-sm flex items-center gap-2 rounded hover:bg-opacity-40 ${resolvedTheme === "dark" ? "text-gray-300 hover:text-white hover:bg-dark-border" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}>
              <span className="max-w-24 overflow-hidden text-ellipsis">{workspaceName}</span>
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            </button>

            {isChartDropdownOpen && (
              <>
                <div className="absolute h-2 w-full -bottom-2 left-0" />
                <div className={`absolute top-[calc(100%+2px)] left-1/2 -translate-x-1/2 w-64 rounded-lg shadow-lg border py-1 z-[60] ${
                  resolvedTheme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"
                }`}>
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${
                      resolvedTheme === "dark"
                        ? "text-gray-300 hover:bg-dark-border hover:text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    Rename Workspace
                  </button>
                  <button
                    onClick={() => {
                      setIsChartDropdownOpen(false);
                      setShowCreateModal(true);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm ${
                      resolvedTheme === "dark"
                        ? "text-gray-300 hover:bg-dark-border hover:text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    Create Chart
                  </button>
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${
                      resolvedTheme === "dark"
                        ? "text-gray-300 hover:bg-dark-border hover:text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    Clone Workspace
                  </button>
                  <div className={`my-1 border-t ${resolvedTheme === "dark" ? "border-dark-border" : "border-gray-200"}`} />
                  <button
                    className={`w-full text-left px-4 py-2 text-sm ${
                      resolvedTheme === "dark"
                        ? "text-red-400 hover:bg-dark-border hover:text-red-300"
                        : "text-red-600 hover:bg-gray-100 hover:text-red-700"
                    }`}
                  >
                    Delete Workspace
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 min-w-[200px] justify-end">
          <div onClick={() => setShowTtlshModal(true)}>
            <StatusDropdown label="Export" items={exportItems} showStatus={false} theme={resolvedTheme} />
          </div>
        </div>
      </nav>

      <CreateChartModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
      <TtlshModal isOpen={showTtlshModal} onClose={() => setShowTtlshModal(false)} />
    </>
  );
}
