import React from "react";
import { FolderPlus, FilePlus } from "lucide-react";
import { useAtom } from "jotai";

// atoms
import { chartsAtom, looseFilesAtom } from "@/atoms/workspace";

// components
import { FileTree } from "@/components/FileTree";

// contexts
import { useTheme } from "@/contexts/ThemeContext";


export function FileBrowser() {
  const { theme } = useTheme();

  const [looseFiles] = useAtom(looseFilesAtom);
  const [charts] = useAtom(chartsAtom);

  const handleNewFile = () => {
  };

  const handleNewFolder = () => {
  };

  return (
    <div
      data-testid="file-browser"
      className={`w-[260px] h-full border-r flex-shrink-0 flex flex-col ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}
    >
      <div className={`p-2 text-xs border-b flex items-center justify-between ${theme === "dark" ? "text-gray-400 border-dark-border" : "text-gray-500 border-gray-200"}`}>
        <span>EXPLORER</span>
        <div className="flex items-center gap-1">
          <button onClick={handleNewFile} className={`p-1 rounded hover:${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} transition-colors`} title="New File">
            <FilePlus className="w-4 h-4" />
          </button>
          <button onClick={handleNewFolder} className={`p-1 rounded hover:${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} transition-colors`} title="New Folder">
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <FileTree
          files={looseFiles}
          charts={charts}
        />
      </div>
    </div>
  );
}
