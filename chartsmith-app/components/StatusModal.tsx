"use client";

import React from "react";
import { X, RotateCw } from "lucide-react";
import { StatusIndicator, type Status } from "./StatusIndicator";
import { useTheme } from "@/contexts/ThemeContext";

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    label: string;
    status: Status;
  };
}

export function StatusModal({ isOpen, onClose, item }: StatusModalProps) {
  const { theme } = useTheme();

  if (!isOpen) return null;

  const handleRerun = () => {
  };

  return (
    <div className="fixed inset-0 bg-forge-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className={`w-full max-w-md rounded-forge-lg shadow-2xl border overflow-hidden ${theme === "dark" ? "bg-forge-charcoal border-forge-iron" : "bg-white border-stone-200"}`}>
        <div className={`flex items-center justify-between p-4 border-b ${theme === "dark" ? "border-forge-iron" : "border-stone-200"}`}>
          <div className="flex items-center gap-3">
            <StatusIndicator status={item.status} className="w-3 h-3" />
            <h2 className={`text-lg font-display font-semibold ${theme === "dark" ? "text-stone-100" : "text-stone-900"}`}>{item.label}</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-forge transition-all ${theme === "dark" ? "text-forge-zinc hover:text-stone-100 hover:bg-forge-iron/50" : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className={`rounded-forge p-4 border ${theme === "dark" ? "bg-forge-black/40 border-forge-iron/50" : "bg-stone-50 border-stone-200"}`}>
              <h3 className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-forge-silver" : "text-stone-700"}`}>Status Details</h3>
              <p className={`text-sm ${theme === "dark" ? "text-forge-zinc" : "text-stone-600"}`}>
                {item.status === "success" && "All checks passed successfully"}
                {item.status === "warning" && "Some checks require attention"}
                {item.status === "error" && "Critical issues detected"}
                {item.status === "loading" && "Running checks..."}
              </p>
            </div>
            <div className={`rounded-forge p-4 border ${theme === "dark" ? "bg-forge-black/40 border-forge-iron/50" : "bg-stone-50 border-stone-200"}`}>
              <h3 className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-forge-silver" : "text-stone-700"}`}>Last Updated</h3>
              <p className={`text-sm ${theme === "dark" ? "text-forge-zinc" : "text-stone-600"}`}>{new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className={`flex justify-end gap-3 p-4 border-t ${theme === "dark" ? "border-forge-iron" : "border-stone-200"}`}>
          <button onClick={onClose} className={`px-4 py-2.5 text-sm font-medium rounded-forge transition-all ${theme === "dark" ? "text-forge-silver hover:text-stone-100 bg-forge-iron/50 hover:bg-forge-iron" : "text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200"}`}>
            Close
          </button>
          <button onClick={handleRerun} className={`px-4 py-2.5 text-sm font-medium rounded-forge transition-all flex items-center gap-2 ${theme === "dark" ? "text-forge-silver hover:text-stone-100 bg-forge-iron/50 hover:bg-forge-iron" : "text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200"}`}>
            <RotateCw className="w-4 h-4" />
            Rerun
          </button>
          <button className="px-4 py-2.5 text-sm font-medium text-white bg-forge-ember hover:bg-forge-ember-bright hover:shadow-ember rounded-forge transition-all">View Details</button>
        </div>
      </div>
    </div>
  );
}
