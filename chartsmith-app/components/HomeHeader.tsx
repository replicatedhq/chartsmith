"use client";
import React from "react";
import { useTheme } from "@/contexts/ThemeContext";

export function HomeHeader() {
  return (
    <div className="max-w-3xl mx-auto text-center mb-8 sm:mb-12 lg:mb-20">
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">
        Welcome to ChartSmith
      </h1>
      <p className="text-gray-400 text-base sm:text-lg">
        Create, modify, and validate your Helm charts with AI assistance
      </p>
    </div>
  );
}
