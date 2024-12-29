"use client";

import React, { useState } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
      {children}
      {isVisible && (
        <div
          className="absolute px-2 py-1 bg-dark-surface text-gray-300 text-xs rounded border border-dark-border whitespace-nowrap z-[9999]"
          style={{
            left: "100%",
            top: "50%",
            transform: "translateY(-50%)",
            marginLeft: "0.5rem",
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
