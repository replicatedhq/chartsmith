import React from "react";
import { FileTree } from "./FileTree";
import { useTheme } from "../../contexts/ThemeContext";
import { FolderPlus, FilePlus } from "lucide-react";
import { WorkspaceFile, Chart } from "@/lib/types/workspace";

interface FileBrowserProps {
  nodes: WorkspaceFile[];
  onFileSelect: (file: WorkspaceFile) => void;
  onFileDelete: (path: string) => void;
  selectedFile?: WorkspaceFile;
  charts: Chart[];  // Add charts prop
}

export function FileBrowser({ nodes, onFileSelect, onFileDelete, selectedFile, charts }: FileBrowserProps) {
  const { theme } = useTheme();

  const handleNewFile = () => {
    // TODO: Implement new file creation
    console.log("Create new file");
  };

  const handleNewFolder = () => {
    // TODO: Implement new folder creation
    console.log("Create new folder");
  };

  return (
    <div className={`w-[260px] h-full border-r flex-shrink-0 flex flex-col ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
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
          files={nodes}
          onFileSelect={onFileSelect}
          onFileDelete={onFileDelete}
          selectedFile={selectedFile}
          charts={charts}  // Pass charts to FileTree
        />
      </div>
    </div>
  );
}
