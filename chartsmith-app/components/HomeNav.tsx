"use client";
import React from "react";
import { AuthButtons } from "./AuthButtons";
import Link from "next/link";
import { Flame } from "lucide-react";

/**
 * Forge Logo for the home nav
 */
function ForgeLogoSmall() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#18181b" />
      <ellipse cx="16" cy="24" rx="10" ry="3" fill="#f97316" fillOpacity="0.3" />
      <path
        d="M8 18L10 14H22L24 18L22 20H10L8 18Z"
        fill="url(#steelGradientNav)"
        stroke="#3f3f46"
        strokeWidth="0.5"
      />
      <path
        d="M11 20H21V24C21 25.1046 20.1046 26 19 26H13C11.8954 26 11 25.1046 11 24V20Z"
        fill="#27272a"
        stroke="#3f3f46"
        strokeWidth="0.5"
      />
      <path
        d="M14 6L18 6L18 12L14 12L14 6Z"
        fill="url(#emberGradientNav)"
        stroke="#ea580c"
        strokeWidth="0.5"
      />
      <rect x="12" y="4" width="8" height="4" rx="1" fill="#f97316" />
      <circle cx="20" cy="10" r="1" fill="#fbbf24" />
      <circle cx="22" cy="8" r="0.5" fill="#f97316" />
      <circle cx="10" cy="9" r="0.75" fill="#fb923c" />

      <defs>
        <linearGradient id="steelGradientNav" x1="8" y1="14" x2="24" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#52525b" />
          <stop offset="0.5" stopColor="#3f3f46" />
          <stop offset="1" stopColor="#27272a" />
        </linearGradient>
        <linearGradient id="emberGradientNav" x1="14" y1="6" x2="18" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="0.5" stopColor="#f97316" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function HomeNav() {
  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between">
        {/* Logo and brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <ForgeLogoSmall />
            <div className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-ember-sm" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-xl font-bold text-stone-100 group-hover:text-forge-ember transition-colors">
              ChartSmith
            </span>
            <span className="text-[10px] tracking-wider text-forge-zinc uppercase">
              by Replicated
            </span>
          </div>
        </Link>

        {/* Auth buttons */}
        <AuthButtons />
      </div>
    </div>
  );
}
