"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePathname } from "next/navigation";
import { SettingsModal } from "./SettingsModal";
import { LogOut, Settings, FolderOpen, ShieldCheck } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/app/hooks/useSession";

export function UserMenu() {
  const { user, signOut, isAdmin } = useAuth();
  const { theme } = useTheme();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { session } = useSession();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 flex items-center justify-center group"
      >
        <div className="relative">
          <Image
            src={user.avatar}
            alt={user.name}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full ring-2 ring-forge-iron group-hover:ring-forge-ember/50 transition-all duration-200"
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-forge-ember rounded-full border-2 border-forge-charcoal" />
        </div>
      </button>

      {isOpen && (
        <div className={`
          absolute ${pathname === '/' ? 'right-0 top-full mt-2' : 'left-16 bottom-full mb-2'}
          w-64 rounded-forge-lg shadow-xl border py-1 z-50
          ${theme === "dark"
            ? "bg-forge-charcoal border-forge-iron"
            : "bg-white border-stone-200"
          }
        `}>
          {/* User info header */}
          <div className={`px-4 py-3 border-b ${theme === "dark" ? "border-forge-iron" : "border-stone-200"}`}>
            <div className={`font-display font-semibold ${theme === "dark" ? "text-stone-100" : "text-stone-900"}`}>
              {user.name}
            </div>
            <div className={`text-sm ${theme === "dark" ? "text-forge-zinc" : "text-stone-500"}`}>
              {user.email}
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/workspaces"
              onClick={() => setIsOpen(false)}
              className={`
                w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors
                ${theme === "dark"
                  ? "text-forge-silver hover:bg-forge-iron/50 hover:text-stone-100"
                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }
              `}
            >
              <FolderOpen className="w-4 h-4 text-forge-ember" />
              My Workspaces
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className={`
                  w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors
                  ${theme === "dark"
                    ? "text-forge-silver hover:bg-forge-iron/50 hover:text-stone-100"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  }
                `}
              >
                <ShieldCheck className="w-4 h-4 text-forge-ember" />
                Admin Panel
              </Link>
            )}

            <button
              onClick={() => {
                setShowSettings(true);
                setIsOpen(false);
              }}
              className={`
                w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors
                ${theme === "dark"
                  ? "text-forge-silver hover:bg-forge-iron/50 hover:text-stone-100"
                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }
              `}
            >
              <Settings className="w-4 h-4 text-forge-ember" />
              Settings
            </button>
          </div>

          {/* Logout - separate section */}
          <div className={`border-t py-1 ${theme === "dark" ? "border-forge-iron" : "border-stone-200"}`}>
            <button
              onClick={signOut}
              className={`
                w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors
                ${theme === "dark"
                  ? "text-forge-zinc hover:bg-red-500/10 hover:text-red-400"
                  : "text-stone-500 hover:bg-red-50 hover:text-red-600"
                }
              `}
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      )}
      {showSettings && session && (
        <SettingsModal 
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)} 
          session={session}
        />
      )}
    </div>
  );
}
