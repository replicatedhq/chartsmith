"use client";
import React from "react";
import { useTheme } from "@/contexts/ThemeContext";

export function HomeHeader() {
  return (
    <div className="max-w-3xl mx-auto text-center mb-20">
      <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">
        Welcome to ChartSmith
      </h1>
      <p className="text-gray-400 text-lg">
        Create, modify, and validate your Helm charts with AI assistance
      </p>
    </div>
  );
}
