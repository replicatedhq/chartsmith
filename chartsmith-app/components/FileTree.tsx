import React from "react";
import { FileText, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { DeleteFileModal } from "./DeleteFileModal";
import { Chart, WorkspaceFile } from "@/lib/types/workspace";
import { selectedFileAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";

interface TreeNode {
  id: string;
  filePath: string;
  content?: string;
  type: "file" | "folder";
  children: TreeNode[];
  name: string;
  pendingPatches?: string[];
}

interface FileTreeProps {
  files: WorkspaceFile[];
  charts: Chart[];
}

export function FileTree({ files = [], charts = [] }: FileTreeProps) {
  const { theme } = useTheme();

  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);

  const prevFilesRef = React.useRef<WorkspaceFile[]>([]);
  const prevChartsRef = React.useRef<Chart[]>([]);

  const buildFileTree = (charts: Chart[] = []) => {
    const treeNodes = charts.map(chart => {
      const chartNode: TreeNode = {
        name: chart.name,
        id: chart.id,
        filePath: chart.id,
        type: "folder",
        content: "",
        children: []
      };

      const folderMap: Record<string, TreeNode> = {};

      chart.files.forEach((file) => {
        if (!file || !file.filePath) {
          console.warn('Invalid file:', file);
          return;
        }

        const parts = file.filePath.split('/');
        let currentNode = chartNode;

        for (let i = 0; i < parts.length - 1; i++) {
          const folderPath = parts.slice(0, i + 1).join('/');
          if (!folderMap[folderPath]) {
            const folderNode: TreeNode = {
              name: parts[i],
              id: `folder-${folderPath}`,
              filePath: folderPath,
              type: "folder",
              content: "",
              children: []
            };
            folderMap[folderPath] = folderNode;
            currentNode.children.push(folderNode);
          }
          currentNode = folderMap[folderPath];
        }

        currentNode.children.push({
          ...file,
          name: parts[parts.length - 1],
          type: "file" as const,
          children: []
        });
      });

      return chartNode;
    });

    return treeNodes;
  };

  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(() => {
    const expanded = new Set(charts.map(chart => chart.id));

    charts.forEach(chart => {
      chart.files.forEach(file => {
        const parts = file.filePath.split('/');
        let path = '';
        for (let i = 0; i < parts.length - 1; i++) {
          path = path ? `${path}/${parts[i]}` : parts[i];
          expanded.add(path);
        }
      });
    });

    return expanded;
  });

  React.useEffect(() => {
    const newFiles = files.filter(file =>
      !prevFilesRef.current.some(prevFile => prevFile.filePath === file.filePath)
    );

    const newCharts = charts.filter(chart =>
      !prevChartsRef.current.some(prevChart => prevChart.id === chart.id)
    );

    if (newFiles.length > 0 || newCharts.length > 0) {
      setExpandedFolders(prev => {
        const expanded = new Set(prev);

        newFiles.forEach(file => {
          const parts = file.filePath.split('/');
          let path = '';
          for (let i = 0; i < parts.length - 1; i++) {
            path = path ? `${path}/${parts[i]}` : parts[i];
            expanded.add(path);
          }
        });

        newCharts.forEach(chart => {
          expanded.add(chart.id);
          chart.files.forEach(file => {
            const parts = file.filePath.split('/');
            let path = '';
            for (let i = 0; i < parts.length - 1; i++) {
              path = path ? `${path}/${parts[i]}` : parts[i];
              expanded.add(path);
            }
          });
        });

        return expanded;
      });
    }

    prevFilesRef.current = files;
    prevChartsRef.current = charts;
  }, [files, charts]);

  const [deleteModal, setDeleteModal] = React.useState<{
    isOpen: boolean;
    filePath: string;
    isRequired: boolean;
  }>({
    isOpen: false,
    filePath: "",
    isRequired: false,
  });

  const treeNodes = buildFileTree(charts);

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

  const getPatchStats = (patches?: string[]) => {
    if (!patches || patches.length === 0) return null;
    // Use the first patch in the array
    const patch = patches[0];
    const lines = patch.split('\n');
    let additions = 0;
    let deletions = 0;
    let contentStarted = false;

    // Check if this is a new file patch (indicated by @@ -0,0 +1,N @@)
    const isNewFile = patch.includes('@@ -0,0 +1,');

    // Check if this is a simple content replacement without proper diff markers
    const isSimpleReplacement = patch.match(/@@ -1,\d+ \+1,\d+ @@/);
    const hasProperDiffMarkers = patch.includes('\n+') || patch.includes('\n-');

    // For new files, count every non-header line as an addition
    if (isNewFile) {
      for (const line of lines) {
        // Skip headers
        if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
          continue;
        }

        // For new files, lines might not be prefixed with '+' in some cases
        additions++;
      }
    }
    // For simple replacement patches without proper markers, compare line counts
    else if (isSimpleReplacement && !hasProperDiffMarkers) {
      console.log("Handling simple replacement patch without markers");

      // Try to extract old and new line counts from the patch header
      const match = patch.match(/@@ -1,(\d+) \+1,(\d+) @@/);
      if (match) {
        const oldLineCount = parseInt(match[1]);
        const newLineCount = parseInt(match[2]);

        // Count the difference as additions or deletions
        if (newLineCount > oldLineCount) {
          additions = newLineCount - oldLineCount;
        } else if (oldLineCount > newLineCount) {
          deletions = oldLineCount - newLineCount;
        }

        // If line counts are the same but content differs, show at least one change
        if (newLineCount === oldLineCount && hasContentChanges(patch)) {
          additions = 1;
          deletions = 1;
        }
      } else {
        // Fallback: count non-header lines
        let lineCount = 0;
        for (const line of lines) {
          if (!line.startsWith('---') && !line.startsWith('+++') && !line.startsWith('@@')) {
            lineCount++;
          }
        }
        additions = lineCount;
      }
    } else {
      // Regular diff processing
      for (const line of lines) {
        if (!contentStarted && line.startsWith('@')) {
          contentStarted = true;
          continue;
        }
        if (contentStarted) {
          if (line.startsWith('+')) additions++;
          if (line.startsWith('-')) deletions++;
        }
      }
    }

    return { additions, deletions };
  };

  // Helper function to check if a patch actually changes content
  const hasContentChanges = (patch: string) => {
    // If the patch is sufficiently different from the original content, assume it has changes
    const headerEndIndex = patch.indexOf('@@');
    if (headerEndIndex === -1) return true;

    const nextNewline = patch.indexOf('\n', headerEndIndex);
    if (nextNewline === -1) return false;

    // There's content after the header, which indicates changes
    return nextNewline < patch.length - 1;
  };

  const renderNode = (node: TreeNode, level: number) => {
    const patchStats = node.type === "file" ? getPatchStats(node.pendingPatches) : null;

    return (
    <div key={node.filePath}>
      <div
        className={`flex items-center py-1 px-2 cursor-pointer rounded-sm group ${selectedFile?.filePath === node.filePath ? `bg-primary/10 text-primary` : theme === "dark" ? "text-gray-300 hover:text-gray-100 hover:bg-dark-border/40" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => {
          if (node.type === "folder") {
            toggleFolder(node.filePath);
          } else {
            const { type: _type, children: _children, ...rest } = node;
            setSelectedFile({
              id: rest.id,
              filePath: rest.filePath,
              content: rest.content || '',
              pendingPatches: rest.pendingPatches
            });
          }
        }}
      >
        <span className="w-4 h-4 mr-1">{node.type === "folder" && (expandedFolders.has(node.filePath) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}</span>
        {node.type === "folder" ? (
          charts.find(c => c.id === node.id) ? (
            <div className={`w-4 h-4 mr-2 ${theme === "dark" ? "text-white" : "text-[#0F1689]"}`}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0zm0 3c.68 0 1.34.068 1.982.191L13.4 4.74c-.46-.064-.927-.1-1.4-.1-.474 0-.94.036-1.4.1l-.582-1.55C10.66 3.069 11.32 3 12 3zm-6 9c0-1.293.416-2.49 1.121-3.467l1.046 1.046c-.11.293-.167.61-.167.942 0 .332.057.65.167.942l-1.046 1.046A5.972 5.972 0 016 12zm6 6c-1.293 0-2.49-.416-3.467-1.121l1.046-1.046c.293.11.61.167.942.167.332 0 .65-.057.942-.167l1.046 1.046A5.972 5.972 0 0112 18zm0-3c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3zm6-3c0 1.293-.416 2.49-1.121 3.467l-1.046-1.046c.11-.293.167-.61.167-.942 0-.332-.057-.65-.167-.942l1.046-1.046A5.972 5.972 0 0118 12z" fill="currentColor"/>
              </svg>
            </div>
          ) : null
        ) : (
          <FileText className={`w-4 h-4 mr-2 ${selectedFile?.filePath === node.filePath ? "text-primary" : theme === "dark" ? "text-gray-400" : "text-gray-500"}`} />
        )}
        <div className="flex-1 flex items-center min-w-0">
          <span className="text-xs truncate">{node.name}</span>
          {patchStats && (
            <span className="ml-2 text-[10px] font-mono whitespace-nowrap">
              {patchStats.additions > 0 && (
                <span className="text-green-500">+{patchStats.additions}</span>
              )}
              {patchStats.additions > 0 && patchStats.deletions > 0 && (
                <span className="mx-0.5">/</span>
              )}
              {patchStats.deletions > 0 && (
                <span className="text-red-500">-{patchStats.deletions}</span>
              )}
            </span>
          )}
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
              if (a.type === "folder" && b.type !== "folder") return -1;
              if (a.type !== "folder" && b.type === "folder") return 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => renderNode(child, level + 1))}
        </div>
      )}
    </div>
  )};

  return (
    <>
      <div className="flex-1 overflow-auto p-2">
        {treeNodes
          .sort((a, b) => {
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

          }
          setDeleteModal({ isOpen: false, filePath: "", isRequired: false });
        }}
      />
    </>
  );
}
