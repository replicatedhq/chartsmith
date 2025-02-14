import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CollapseButtonProps {
  isCollapsed: boolean;
  onClick: () => void;
}

export function CollapseButton({ isCollapsed, onClick }: CollapseButtonProps) {
  return (
    <button onClick={onClick} className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-24 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors border border-gray-700 group">
      {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-300" /> : <ChevronLeft className="w-4 h-4 text-gray-400 group-hover:text-gray-300" />}
    </button>
  );
}
