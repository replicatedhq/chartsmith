"use client";

import React, { useState } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className="
            absolute px-2.5 py-1.5
            bg-forge-charcoal text-forge-silver text-xs font-medium
            rounded-forge border border-forge-iron
            whitespace-nowrap z-[9999]
            shadow-lg
            animate-in fade-in duration-150
          "
          style={{
            left: "100%",
            top: "50%",
            transform: "translateY(-50%)",
            marginLeft: "0.5rem",
          }}
        >
          {content}
          {/* Arrow */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-forge-charcoal border-l border-b border-forge-iron rotate-45" />
        </div>
      )}
    </div>
  );
}
