"use client";
import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { AuthButtons } from "./AuthButtons";

export function HomeNav() {
  const { resolvedTheme } = useTheme();

  return (
    <div className="p-8 md:p-12">
      <div className="flex justify-end">
        <AuthButtons />
      </div>
    </div>
  );
}
