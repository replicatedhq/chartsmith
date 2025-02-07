"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePathname } from "next/navigation";
import { SettingsModal } from "./SettingsModal";
import { LogOut, Settings, FolderOpen } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/app/hooks/useSession";

export function UserMenu() {
  const { user, signOut } = useAuth();
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
      <button onClick={() => setIsOpen(!isOpen)} className="w-10 h-10 flex items-center justify-center">
        <Image src={user.avatar} alt={user.name} width={32} height={32} className="w-8 h-8 rounded-full" />
      </button>

      {isOpen && (
        <div className={`absolute ${pathname === '/' ? 'right-0 top-full mt-2' : 'left-16 bottom-full mb-2'} w-64 rounded-lg shadow-lg border py-1 z-50 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
          <div className={`px-4 py-2 border-b ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
            <div className={`font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{user.name}</div>
            <div className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>{user.email}</div>
          </div>
          <Link 
            href="/workspaces"
            onClick={() => setIsOpen(false)}
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${theme === "dark" ? "text-gray-300 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-50"}`}
          >
            <FolderOpen className="w-4 h-4" />
            My Workspaces
          </Link>
          <button 
            onClick={() => {
              setShowSettings(true);
              setIsOpen(false);
            }} 
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${theme === "dark" ? "text-gray-300 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-50"}`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button 
            onClick={signOut} 
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${theme === "dark" ? "text-gray-300 hover:bg-dark-border/40" : "text-gray-700 hover:bg-gray-50"}`}
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
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
