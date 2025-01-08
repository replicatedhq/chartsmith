import React from "react";
import { FolderOpen, FileText, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { DeleteFileModal } from "../DeleteFileModal";
import { FileNode } from "@/lib/types/files";

interface FileTreeProps {
  nodes: FileNode[];
  onFileSelect: (file: FileNode) => void;
  onFileDelete: (path: string) => void;
  selectedFile?: FileNode;
}

export function FileTree({ nodes, onFileSelect, onFileDelete, selectedFile }: FileTreeProps) {
  const { theme } = useTheme();
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set(["templates"]));
  const [deleteModal, setDeleteModal] = React.useState<{
    isOpen: boolean;
    filePath: string;
    isRequired: boolean;
  }>({
    isOpen: false,
    filePath: "",
    isRequired: false,
  });

  // Convert flat file list into tree structure
  const buildFileTree = (files: FileNode[]) => {
    const tree: Record<string, FileNode & { children: FileNode[] }> = {};

    // First create folder nodes
    files.forEach((file) => {
      const parts = file.path.split("/");
      let currentPath = "";

      parts.slice(0, -1).forEach((part) => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!tree[currentPath]) {
          tree[currentPath] = {
            name: part,
            path: currentPath,
            type: "folder",
            children: [],
            content: "",
          };

          if (parentPath && tree[parentPath]) {
            tree[parentPath].children.push(tree[currentPath]);
          }
        }
      });
    });

    // Then add files to their parent folders
    files.forEach((file) => {
      const parts = file.path.split("/");
      if (parts.length === 1) {
        // Root level files
        if (!tree[file.path]) {
          tree[file.path] = { ...file, children: [] };
        }
      } else {
        // Files in folders
        const parentPath = parts.slice(0, -1).join("/");
        if (tree[parentPath]) {
          tree[parentPath].children.push(file);
        }
      }
    });

    // Return only root level items
    return Object.values(tree).filter((item) => !item.path.includes("/"));
  };

  const treeNodes = buildFileTree(nodes);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleDelete = (node: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.path) {
      const fileName = node.path.split("/").pop();
      const isRequired = fileName === "Chart.yaml" || fileName === "values.yaml";

      setDeleteModal({
        isOpen: true,
        filePath: node.path,
        isRequired,
      });
    }
  };

  const renderNode = (node: FileNode & { children?: FileNode[] }, level: number) => (
    <div key={node.path}>
      <div
        className={`flex items-center py-1 px-2 cursor-pointer rounded-sm group ${selectedFile?.path === node.path ? `bg-primary/10 text-primary` : theme === "dark" ? "text-gray-300 hover:text-gray-100 hover:bg-dark-border/40" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => {
          if (node.type === "folder") {
            toggleFolder(node.path);
          } else {
            onFileSelect(node);
          }
        }}

      >
        <span className="w-4 h-4 mr-1">{node.type === "folder" && (expandedFolders.has(node.path) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}</span>
        {node.type === "folder" ? (
          <FolderOpen className={`w-4 h-4 mr-2 ${expandedFolders.has(node.path) ? "text-primary" : theme === "dark" ? "text-blue-400" : "text-blue-500"}`} />
        ) : (
          <FileText className={`w-4 h-4 mr-2 ${selectedFile?.path === node.path ? "text-primary" : theme === "dark" ? "text-gray-400" : "text-gray-500"}`} />
        )}
        <span className="text-sm flex-1">{node.name}</span>
        {node.type === "file" && (
          <button 
            onClick={(e) => handleDelete(node, e)} 
            className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center ${theme === "dark" ? "hover:bg-dark-border/60 text-gray-400 hover:text-white" : "hover:bg-gray-200 text-gray-500 hover:text-gray-700"}`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      {node.type === "folder" && node.children && expandedFolders.has(node.path) && (
        <div>
          {node.children
            .sort((a, b) => {
              // Folders first, then files
              if (a.type === "folder" && b.type !== "folder") return -1;
              if (a.type !== "folder" && b.type === "folder") return 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => renderNode(child, level + 1))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div>
        {treeNodes
          .sort((a, b) => {
            // Folders first, then files
            if (a.type === "folder" && b.type !== "folder") return -1;
            if (a.type !== "folder" && b.type === "folder") return 1;
            return a.name.localeCompare(b.name);
          })
          .map((node) => renderNode(node, 0))}
      </div>

      <DeleteFileModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, filePath: "", isRequired: false })}
        filePath={deleteModal.filePath}
        isRequired={deleteModal.isRequired}
        onConfirm={() => {
          if (!deleteModal.isRequired && deleteModal.filePath) {
            onFileDelete(deleteModal.filePath);
          }
          setDeleteModal({ isOpen: false, filePath: "", isRequired: false });
        }}
      />
    </>
  );
}
