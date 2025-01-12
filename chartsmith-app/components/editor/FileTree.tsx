import React from "react";
import { FolderOpen, FileText, ChevronDown, ChevronRight, Trash2, FilePlus, FolderPlus } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { DeleteFileModal } from "../DeleteFileModal";
import { WorkspaceFile } from "@/lib/types/workspace";

interface TreeNode {
  id: string;
  filePath: string;  // Match backend property name
  content?: string;  // Make content optional to match File type
  type: "file" | "folder";
  children: TreeNode[];  // Make children required for folders
  name: string;
}

interface FileTreeProps {
  files: WorkspaceFile[];
  onFileSelect: (file: WorkspaceFile) => void;
  onFileDelete: (filePath: string) => void;
  selectedFile?: WorkspaceFile;
}

export function FileTree({ files = [], onFileSelect, onFileDelete, selectedFile }: FileTreeProps) {
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
  const buildFileTree = (files: WorkspaceFile[] = []) => {
    const tree: Record<string, TreeNode> = {};

    // First create folder nodes
    files.forEach((file) => {
      if (!file || !file.filePath) {
        console.warn('Invalid file:', file);
        return;
      }

      const parts = file.filePath.split("/");
      let currentPath = "";

      parts.slice(0, -1).forEach((part) => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!tree[currentPath]) {
          tree[currentPath] = {
            name: part,
            id: `folder-${currentPath}`,
            filePath: currentPath,
            content: "",  // Empty string for folders
            type: "folder" as const,
            children: [] as TreeNode[]  // Initialize with proper type
          };

          if (parentPath && tree[parentPath] && tree[parentPath].children) {
            tree[parentPath].children.push(tree[currentPath]);
          }
        }
      });
    });

    // Then add files to their parent folders
    files.forEach((file) => {
      const parts = file.filePath.split("/");
      if (parts.length === 1) {
        // Root level files
        if (!tree[file.filePath]) {          tree[file.filePath] = { 
            ...file,
            name: file.filePath.split('/').pop() || file.filePath,
            type: "file" as const,
            children: [] as TreeNode[]
          };
        }
      } else {
        // Files in folders
        const parentPath = parts.slice(0, -1).join("/");
        if (tree[parentPath]) {
          tree[parentPath].children!.push({
            ...file,
            name: file.filePath.split('/').pop() || file.filePath,
            type: "file" as const,
            children: [] as TreeNode[]
          });
        }
      }
    });

    const rootNodes = Object.values(tree).filter((item) => !item.filePath.includes("/"));
    return rootNodes;
  };

  const treeNodes = buildFileTree(files);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleDelete = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.filePath) {
      const fileName = node.filePath.split("/").pop();
      const isRequired = fileName === "Chart.yaml" || fileName === "values.yaml";

      setDeleteModal({
        isOpen: true,
        filePath: node.filePath,
        isRequired,
      });
    }
  };

  const renderNode = (node: TreeNode, level: number) => (
    <div key={node.filePath}>
      <div
        className={`flex items-center py-1 px-2 cursor-pointer rounded-sm group ${selectedFile?.filePath === node.filePath ? `bg-primary/10 text-primary` : theme === "dark" ? "text-gray-300 hover:text-gray-100 hover:bg-dark-border/40" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => {
          if (node.type === "folder") {
            toggleFolder(node.filePath);
          } else {
            // Strip out tree-specific properties before passing to parent
            // Strip out tree-specific properties and ensure content is a string
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { type: _type, children: _children, ...rest } = node;
            onFileSelect({
              id: rest.id,
              filePath: rest.filePath,
              content: rest.content || ''
            });
          }
        }}

      >
        <span className="w-4 h-4 mr-1">{node.type === "folder" && (expandedFolders.has(node.filePath) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}</span>
        {node.type === "folder" ? (
          <FolderOpen className={`w-4 h-4 mr-2 ${expandedFolders.has(node.filePath) ? "text-primary" : theme === "dark" ? "text-blue-400" : "text-blue-500"}`} />
        ) : (
          <FileText className={`w-4 h-4 mr-2 ${selectedFile?.filePath === node.filePath ? "text-primary" : theme === "dark" ? "text-gray-400" : "text-gray-500"}`} />
        )}
        <div className="flex-1 flex items-center min-w-0">
          <span className="text-sm truncate">{node.name}</span>
        </div>
        <button
          onClick={(e) => node.type === "file" && handleDelete(node, e)}
          className={`p-1 rounded w-5 flex-shrink-0 ${
            node.type === "file"
              ? `opacity-0 group-hover:opacity-100 transition-opacity ${
                  theme === "dark"
                    ? "hover:bg-dark-border/60 text-gray-400 hover:text-white"
                    : "hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                }`
              : "invisible"
          }`}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {node.type === "folder" && node.children && expandedFolders.has(node.filePath) && (
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

  const handleNewFile = () => {
    // TODO: Implement new file creation
    console.log("Create new file");
  };

  const handleNewFolder = () => {
    // TODO: Implement new folder creation
    console.log("Create new folder");
  };

  return (
    <div className={`h-full border-r flex-shrink-0 flex flex-col ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <div className={`p-2 text-sm border-b flex items-center justify-between ${theme === "dark" ? "text-gray-400 border-dark-border" : "text-gray-500 border-gray-200"}`}>
        <span>EXPLORER</span>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleNewFile} 
            className={`p-1 rounded transition-colors ${
              theme === "dark" 
                ? "hover:bg-dark-border/40" 
                : "hover:bg-gray-100"
            }`} 
            title="New File"
          >
            <FilePlus className="w-4 h-4" />
          </button>
          <button 
            onClick={handleNewFolder} 
            className={`p-1 rounded transition-colors ${
              theme === "dark" 
                ? "hover:bg-dark-border/40" 
                : "hover:bg-gray-100"
            }`} 
            title="New Folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2">
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
    </div>
  );
}
