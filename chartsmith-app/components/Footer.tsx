"use client";

import React from "react";
import Link from "next/link";
import { Flame } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto py-6 px-8">
      <div className="flex items-center justify-between">
        {/* Left side - Forge branding */}
        <div className="flex items-center gap-2 text-forge-zinc">
          <Flame className="w-3.5 h-3.5 text-forge-ember/60" />
          <span className="text-xs font-medium">
            Forged with <span className="text-forge-ember">♥</span> by Replicated
          </span>
        </div>

        {/* Right side - Links */}
        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/terms"
            className="text-forge-zinc hover:text-forge-silver transition-colors duration-200"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-forge-zinc hover:text-forge-silver transition-colors duration-200"
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
