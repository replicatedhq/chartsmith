"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { StatusDropdown } from "./StatusDropdown";
import { TtlshModal } from "./TtlshModal";
import { Upload, Flame } from "lucide-react";

const exportItems = [{ label: "Push to ttl.sh" }];

/**
 * Forge Logo - A distinctive anvil/hammer mark
 * Represents the craft of "smithing" Helm charts
 */
function ForgeLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background - dark steel plate */}
      <rect width="32" height="32" rx="6" fill="#18181b" />

      {/* Ember glow behind the anvil */}
      <ellipse cx="16" cy="24" rx="10" ry="3" fill="#f97316" fillOpacity="0.3" />

      {/* Anvil body */}
      <path
        d="M8 18L10 14H22L24 18L22 20H10L8 18Z"
        fill="url(#steelGradient)"
        stroke="#3f3f46"
        strokeWidth="0.5"
      />

      {/* Anvil base */}
      <path
        d="M11 20H21V24C21 25.1046 20.1046 26 19 26H13C11.8954 26 11 25.1046 11 24V20Z"
        fill="#27272a"
        stroke="#3f3f46"
        strokeWidth="0.5"
      />

      {/* Hammer */}
      <path
        d="M14 6L18 6L18 12L14 12L14 6Z"
        fill="url(#emberGradient)"
        stroke="#ea580c"
        strokeWidth="0.5"
      />

      {/* Hammer head */}
      <rect x="12" y="4" width="8" height="4" rx="1" fill="#f97316" />

      {/* Spark effects */}
      <circle cx="20" cy="10" r="1" fill="#fbbf24" />
      <circle cx="22" cy="8" r="0.5" fill="#f97316" />
      <circle cx="10" cy="9" r="0.75" fill="#fb923c" />

      <defs>
        <linearGradient id="steelGradient" x1="8" y1="14" x2="24" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#52525b" />
          <stop offset="0.5" stopColor="#3f3f46" />
          <stop offset="1" stopColor="#27272a" />
        </linearGradient>
        <linearGradient id="emberGradient" x1="14" y1="6" x2="18" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="0.5" stopColor="#f97316" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function TopNav() {
  const [showTtlshModal, setShowTtlshModal] = useState(false);
  const { resolvedTheme } = useTheme();

  return (
    <>
      <nav
        className={`
          h-16 border-b flex items-center justify-between px-6 relative z-50
          transition-colors duration-200
          ${resolvedTheme === "dark"
            ? "border-forge-iron bg-forge-charcoal"
            : "border-stone-200 bg-stone-50"
          }
        `}
      >
        {/* Logo and Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 group"
        >
          <div className="relative">
            <ForgeLogo className="transition-transform duration-200 group-hover:scale-105" />
            {/* Subtle glow on hover */}
            <div className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-ember-sm" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className={`
                font-display text-xl font-bold tracking-tight
                transition-colors duration-200
                ${resolvedTheme === "dark" ? "text-stone-100" : "text-stone-900"}
                group-hover:text-forge-ember
              `}>
                ChartSmith
              </span>
              <span className={`
                text-overline uppercase tracking-widest
                ${resolvedTheme === "dark" ? "text-forge-zinc" : "text-stone-400"}
              `}>
                by Replicated
              </span>
            </div>
            <span className={`
              text-[10px] tracking-wide font-medium
              ${resolvedTheme === "dark" ? "text-forge-ember/60" : "text-forge-ember-dim/60"}
            `}>
              Forge your Helm charts
            </span>
          </div>
        </Link>

        {/* Center - Status indicator dot */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-forge-ember ember-pulse" />
            <span className={`
              text-xs font-medium
              ${resolvedTheme === "dark" ? "text-forge-zinc" : "text-stone-400"}
            `}>
              Ready to forge
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <StatusDropdown
            label={
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>Export</span>
              </span>
            }
            items={exportItems}
            showStatus={false}
            theme={resolvedTheme}
            onItemClick={(item) => {
              if (item.label === "Push to ttl.sh") {
                setShowTtlshModal(true);
              }
            }}
          />
        </div>
      </nav>

      <TtlshModal isOpen={showTtlshModal} onClose={() => setShowTtlshModal(false)} />
    </>
  );
}
