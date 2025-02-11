"use client"

import React from "react";
import { Home, Code, Lightbulb, FileJson, History } from "lucide-react";
import { UserMenu } from "./UserMenu";
import { useTheme } from "@/contexts/ThemeContext";
import { usePathname } from "next/navigation";
import { Tooltip } from "./ui/Tooltip";
import Link from "next/link";
import { useWorkspaceUI } from "@/contexts/WorkspaceUIContext";

interface SideNavProps {
  workspaceID: string;
}

export function SideNav({ workspaceID }: SideNavProps) {
  const { theme } = useTheme();
  const { isChatVisible, setIsChatVisible, isFileTreeVisible, setIsFileTreeVisible } = useWorkspaceUI();

  return (
    <nav className={`w-16 flex-shrink-0 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-light-surface border-light-border"} border-r flex flex-col justify-between`}>
      <div className="py-4 flex flex-col items-center">
        <Tooltip content="Home">
          <Link href="/" className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${usePathname() === "/" ? "text-primary" : `text-neutral hover:${theme === "dark" ? "bg-dark-border/40" : "bg-light-border/40"}`}`}>
            <Home className="w-5 h-5" />
          </Link>
        </Tooltip>

        <div className="mt-8 w-full px-3">
          <div className={`border-t ${theme === "dark" ? "border-dark-border" : "border-light-border"}`} />
        </div>

        <div className="mt-4">
          <Tooltip content="Editor">
            <Link
              href={`/workspace/${workspaceID}`}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${usePathname() === `/workspace/${workspaceID}` ? `${theme === "dark" ? "bg-dark-border/60" : "bg-light-border/60"} text-primary` : `text-neutral hover:${theme === "dark" ? "bg-dark-border/40" : "bg-light-border/40"}`}`}
            >
              <Code className="w-5 h-5" />
            </Link>
          </Tooltip>
        </div>

        <div className="mt-2">
          <Tooltip content="Recommendations">
            <Link
              href={`/workspace/${workspaceID}/recommendations`}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative ${usePathname() === `/workspace/${workspaceID}/recommendations` ? `${theme === "dark" ? "bg-dark-border/60" : "bg-light-border/60"} text-primary` : `text-neutral hover:${theme === "dark" ? "bg-dark-border/40" : "bg-light-border/40"}`}`}
            >
              <Lightbulb className="w-5 h-5" />
              <div className="absolute -top-1 -right-1 bg-error text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">4</div>
            </Link>
          </Tooltip>
        </div>

      </div>

      <div className="py-4 flex justify-center">
        <UserMenu />
      </div>
    </nav>
  );
}
