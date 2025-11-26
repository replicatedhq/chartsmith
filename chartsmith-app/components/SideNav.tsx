"use client"

import React from "react";
import { Home, Code, Lightbulb, FileJson, History, Flame } from "lucide-react";
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
  const pathname = usePathname();

  const NavLink = ({
    href,
    icon: Icon,
    tooltip,
    isActive
  }: {
    href: string;
    icon: React.ElementType;
    tooltip: string;
    isActive: boolean;
  }) => (
    <Tooltip content={tooltip}>
      <Link
        href={href}
        className={`
          relative w-10 h-10 flex items-center justify-center rounded-forge
          transition-all duration-200 group
          ${isActive
            ? theme === "dark"
              ? "bg-forge-ember/20 text-forge-ember"
              : "bg-forge-ember/10 text-forge-ember-dim"
            : theme === "dark"
              ? "text-forge-zinc hover:text-forge-silver hover:bg-forge-iron/50"
              : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"
          }
        `}
      >
        <Icon className="w-5 h-5" />
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-forge-ember rounded-r" />
        )}
      </Link>
    </Tooltip>
  );

  return (
    <nav className={`
      w-16 flex-shrink-0 border-r flex flex-col justify-between
      ${theme === "dark"
        ? "bg-forge-charcoal border-forge-iron"
        : "bg-stone-50 border-stone-200"
      }
    `}>
      {/* Top section */}
      <div className="py-4 flex flex-col items-center">
        {/* Home link */}
        <NavLink
          href="/"
          icon={Home}
          tooltip="Home"
          isActive={pathname === "/"}
        />

        {/* Divider with ember accent */}
        <div className="mt-6 w-full px-3">
          <div className={`
            relative h-px
            ${theme === "dark" ? "bg-forge-iron" : "bg-stone-200"}
          `}>
            <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rounded-full bg-forge-ember/40" />
          </div>
        </div>

        {/* Editor link */}
        <div className="mt-6">
          <NavLink
            href={`/workspace/${workspaceID}`}
            icon={Code}
            tooltip="Editor"
            isActive={pathname === `/workspace/${workspaceID}`}
          />
        </div>

        {/* Recommendations link - commented out
        <div className="mt-2">
          <NavLink
            href={`/workspace/${workspaceID}/recommendations`}
            icon={Lightbulb}
            tooltip="Recommendations"
            isActive={pathname === `/workspace/${workspaceID}/recommendations`}
          />
        </div>
        */}
      </div>

      {/* Bottom section with user menu */}
      <div className="py-4 flex flex-col items-center gap-3">
        {/* Forge status indicator */}
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center
          ${theme === "dark" ? "bg-forge-iron/50" : "bg-stone-100"}
        `}>
          <Flame className="w-4 h-4 text-forge-ember ember-pulse" />
        </div>

        <UserMenu />
      </div>
    </nav>
  );
}
