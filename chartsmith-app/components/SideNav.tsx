import React from "react";
import { Home, FolderKanban, Lightbulb, MessageSquare, FileJson } from "lucide-react";
import { UserMenu } from "./UserMenu";
import { useTheme } from "@/contexts/ThemeContext";
import { usePathname } from "next/navigation";
import { Tooltip } from "./ui/Tooltip";
import Link from "next/link";

interface SideNavProps {
  workspaceID: string;
  isChatVisible?: boolean;
  onToggleChat?: () => void;
  isFileTreeVisible?: boolean;
  onToggleFileTree?: () => void;
}

export function SideNav({ workspaceID, isChatVisible = true, onToggleChat, isFileTreeVisible = true, onToggleFileTree }: SideNavProps) {
  const { theme } = useTheme();

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
          <Tooltip content="Toggle Chat">
            <button onClick={onToggleChat} className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${isChatVisible ? `${theme === "dark" ? "bg-dark-border/60" : "bg-light-border/60"} text-primary` : `text-neutral hover:${theme === "dark" ? "bg-dark-border/40" : "bg-light-border/40"}`}`}>
              <MessageSquare className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        <div className="mt-2">
          <Tooltip content="Toggle File Explorer">
            <button
              onClick={onToggleFileTree}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${isFileTreeVisible ? `${theme === "dark" ? "bg-dark-border/60" : "bg-light-border/60"} text-primary` : `text-neutral hover:${theme === "dark" ? "bg-dark-border/40" : "bg-light-border/40"}`}`}
            >
              <FolderKanban className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        <div className="mt-2">
          <Tooltip content="Values.yaml Scenarios">
            <Link
              href={`/workspace/${workspaceID}/values`}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${usePathname() === "/values" ? `${theme === "dark" ? "bg-dark-border/60" : "bg-light-border/60"} text-primary` : `text-neutral hover:${theme === "dark" ? "bg-dark-border/40" : "bg-light-border/40"}`}`}
            >
              <FileJson className="w-5 h-5" />
            </Link>
          </Tooltip>
        </div>

        <div className="mt-2">
          <Tooltip content="View Recommendations">
            <Link
              href={`/workspace/${workspaceID}/recommendations`}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative ${usePathname() === "/recommendations" ? `${theme === "dark" ? "bg-dark-border/60" : "bg-light-border/60"} text-primary` : `text-neutral hover:${theme === "dark" ? "bg-dark-border/40" : "bg-light-border/40"}`}`}
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
