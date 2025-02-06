"use client";
import React from "react";
import { useTheme } from "@/contexts/ThemeContext";

export function HomeHeader() {
  const { theme } = useTheme();

  return (
    <div suppressHydrationWarning className={`text-center py-16 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
      <h1 className="text-4xl font-bold mb-4">Welcome to ChartSmith</h1>
      <p className={`text-xl ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
        Create, modify, and validate your Helm charts with AI assistance
      </p>
    </div>
  );
}
