"use client";
import React from "react";

import { useTheme } from "@/contexts/ThemeContext";
import { AuthButtons } from "./AuthButtons";

export function HomeHeader() {
  const { theme } = useTheme();

  return (
    <div className="px-4">
      <div className="flex justify-end mb-16">
        <AuthButtons />
      </div>
      <div className="text-center">
        <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Build Better Helm Charts</h1>
        <p className={`text-xl ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Create and validate Kubernetes Helm charts to better support enterprise environments</p>
      </div>
    </div>
  );
}
