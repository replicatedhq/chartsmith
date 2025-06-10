"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { StatusDropdown } from "./StatusDropdown";
import { TtlshModal } from "./TtlshModal";
import { ZipDownloadModal } from "./ZipDownloadModal";

// Removed evalItems

const exportItems = [
  { label: "Push to ttl.sh" },
  { label: "Download as Zip" }
];

export function TopNav() {
  const [showTtlshModal, setShowTtlshModal] = useState(false);
  const [showZipModal, setShowZipModal] = useState(false);
  const { resolvedTheme } = useTheme();

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

        <div className="flex-1">
          {/* Center section intentionally left empty */}
        </div>

        <div className="flex items-center space-x-2 min-w-[200px] justify-end">
          <StatusDropdown 
            label="Export" 
            items={exportItems} 
            showStatus={false} 
            theme={resolvedTheme}
            onItemClick={(item) => {
              if (item.label === "Push to ttl.sh") {
                setShowTtlshModal(true);
              } else if (item.label === "Download as Zip") {
                setShowZipModal(true);
              }
            }} 
          />
        </div>
      </nav>

      <TtlshModal isOpen={showTtlshModal} onClose={() => setShowTtlshModal(false)} />
      <ZipDownloadModal isOpen={showZipModal} onClose={() => setShowZipModal(false)} />
    </>
  );
}
