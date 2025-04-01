"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Status, StatusIndicator } from "./StatusIndicator";
import { StatusModal } from "./StatusModal";
import { PublishModal } from "./PublishModal";
import { WorkInCliModal } from "./WorkInCLIModal";

interface StatusItem {
  label: string;
  status?: Status;
}

interface StatusDropdownProps {
  label: string;
  items: StatusItem[];
  showStatus?: boolean;
  theme?: "light" | "dark";
}

export function StatusDropdown({ label, items, showStatus = true, theme = "dark" }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StatusItem | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showWorkInCliModal, setShowWorkInCliModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 100);
  };

  const handleItemClick = (item: StatusItem) => {
    setIsOpen(false);
    if (item.label === "Publish to Replicated") {
      setShowPublishModal(true);
    } else if (item.label === "Work in CLI") {
      setShowWorkInCliModal(true);
    } else if (item.label === "Push to ttl.sh") {
      setShowPublishModal(true); // Reusing the publish modal for ttl.sh for now
    } else if (item.status) {
      setSelectedItem(item);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className="relative" ref={dropdownRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <button className={`px-3 py-1.5 text-sm flex items-center gap-2 rounded hover:bg-opacity-40 ${theme === "dark" ? "text-gray-300 hover:text-white hover:bg-dark-border/40" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"}`}>
          {label}
          <ChevronDown className="w-4 h-4" />
        </button>

        {isOpen && (
          <div className={`absolute top-full right-0 mt-1 w-48 rounded-lg shadow-lg border py-1 z-[60] ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {items.map((item, index) => (
              <React.Fragment key={index}>
                {index === 2 && label === "Eval" && <div className={`my-1 border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`} />}
                <button onClick={() => handleItemClick(item)} className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between group ${theme === "dark" ? "text-gray-300 hover:bg-dark-border/40 hover:text-white" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}>
                  <span>{item.label}</span>
                  {showStatus && item.status && <StatusIndicator status={item.status} />}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {showStatus && selectedItem?.status && <StatusModal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} item={selectedItem as Required<StatusItem>} />}

      <PublishModal isOpen={showPublishModal} onClose={() => setShowPublishModal(false)} />

      <WorkInCliModal isOpen={showWorkInCliModal} onClose={() => setShowWorkInCliModal(false)} />
    </>
  );
}
