"use client";

import React from "react";
import { Twitter, Github } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";

export function Footer() {
  const { resolvedTheme } = useTheme();

  return (
    <footer className={`fixed bottom-0 left-0 right-0 ${resolvedTheme === "dark" ? "bg-[#0D1117] border-gray-800" : "bg-white border-gray-200"} border-t`}>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-end">
        <div className="flex items-center space-x-6">
          <a href="https://twitter.com/replicatedhq" className={`${resolvedTheme === "dark" ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}>
            <Twitter className="w-5 h-5" />
          </a>
          <a href="https://github.com/replicatedhq" className={`${resolvedTheme === "dark" ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}>
            <Github className="w-5 h-5" />
          </a>
          <span className={resolvedTheme === "dark" ? "text-gray-600" : "text-gray-400"}>•</span>
          <Link href="/terms" className={`${resolvedTheme === "dark" ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}>
            Terms
          </Link>
          <Link href="/privacy" className={`${resolvedTheme === "dark" ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}>
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
