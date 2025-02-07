"use client";
import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { AuthButtons } from "./AuthButtons";

export function HomeNav() {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex justify-end px-4">
      <AuthButtons />
    </div>
  );
}
