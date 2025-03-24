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
  contentPending?: string;
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

  // Helper function to expand parent directories for a file path
  const expandParentDirectories = React.useCallback((filePath: string | undefined, chartId?: string) => {
    if (!filePath) return;
    
    setExpandedFolders(prev => {
      const expanded = new Set(prev);
      
      // If this file belongs to a chart, make sure the chart folder is expanded
      if (chartId) {
        expanded.add(chartId);
      }
      
      // Add all parent directories to the expandedFolders set
      const parts = filePath.split('/');
      let path = '';
      for (let i = 0; i < parts.length - 1; i++) {
        path = path ? `${path}/${parts[i]}` : parts[i];
        expanded.add(path);
      }
      
      return expanded;
    });
  }, []);

  // Effect to expand parent directories when a file is selected
  React.useEffect(() => {
    if (selectedFile?.filePath) {
      // Find the chart this file belongs to, if any
      const chartId = charts.find(chart => 
        chart.files.some(file => file.filePath === selectedFile.filePath)
      )?.id;
      
      expandParentDirectories(selectedFile.filePath, chartId);
    }
  }, [selectedFile?.filePath, expandParentDirectories, charts]);

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

  // Import the diff library at the top of the file
  // import { diffLines } from 'diff';
  
  // Calculate differences between two content strings using the diff library
  const getContentDiffStats = (originalContent: string, newContent: string) => {
    if (!originalContent && !newContent) {
      return { additions: 0, deletions: 0 };
    }
    
    // Special case: If original content is empty or just whitespace,
    // treat all lines in new content as additions with no deletions
    if (!originalContent || originalContent.trim() === "") {
      const lines = newContent.endsWith('\n')
        ? newContent.split('\n').length - 1
        : newContent.split('\n').length;
      
      return { additions: lines, deletions: 0 };
    }
    
    // Special case: If new content is empty or just whitespace,
    // treat all lines in original content as deletions with no additions
    if (!newContent || newContent.trim() === "") {
      const lines = originalContent.endsWith('\n')
        ? originalContent.split('\n').length - 1
        : originalContent.split('\n').length;
      
      return { additions: 0, deletions: lines };
    }

    if (originalContent === newContent) {
      return { additions: 0, deletions: 0 };
    }

    // Import the diff function directly to avoid issues with module imports
    // This is a workaround since we're editing an existing file
    const diffLines = require('diff').diffLines;
    
    // Use the diffLines function to compare the two strings
    const changes = diffLines(originalContent, newContent);
    
    let additions = 0;
    let deletions = 0;
    
    // Process each change and count additions and deletions
    for (const change of changes) {
      // Count the number of lines more accurately
      // If the string ends with a newline, we don't want to count an extra empty line
      const lines = change.value.endsWith('\n') 
        ? change.value.split('\n').length - 1 
        : change.value.split('\n').length;
      
      // Skip empty changes
      if (lines === 0) continue;
      
      if (change.added) {
        additions += lines;
      } else if (change.removed) {
        deletions += lines;
      }
    }
    
    return { additions, deletions };
  };

  const getPatchStats = (contentPending?: string, content?: string) => {
    // Use our improved getContentDiffStats function to handle all cases,
    // including empty original content
    if (contentPending) {
      return getContentDiffStats(content || "", contentPending);
    }

    // Default case with no pending changes to show
    return { additions: 0, deletions: 0 };
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

  // Create a ref for selected file elements
  const selectedNodeRef = React.useRef<HTMLDivElement>(null);

  // Reference to the outer container of the file tree
  const treeContainerRef = React.useRef<HTMLDivElement>(null);

  // Add effect to scroll selected element into view
  React.useEffect(() => {
    if (!selectedFile?.filePath) return;
    
    console.log("Selected file path changed:", selectedFile.filePath);
    
    // First ensure folders are expanded
    const chartId = charts.find(chart => 
      chart.files.some(file => file.filePath === selectedFile.filePath)
    )?.id;
    
    expandParentDirectories(selectedFile.filePath, chartId);
    
    // Then scroll the element into view after DOM updates
    const scrollTimeout = setTimeout(() => {
      if (selectedNodeRef.current) {
        console.log("Scrolling node into view:", selectedFile.filePath);
        // Use a more reliable scroll approach
        selectedNodeRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center', // Center the element in the viewport
        });
      } else {
        console.log("Node reference not found for:", selectedFile.filePath);
        console.log("Available nodes:", [...fileNodesMap.current.keys()]);
      }
    }, 500); // Longer timeout to ensure all DOM updates have completed
    
    return () => clearTimeout(scrollTimeout);
  }, [selectedFile?.filePath, expandParentDirectories, charts]);

  // Map to keep track of all file nodes by their filePath for easier reference
  const fileNodesMap = React.useRef(new Map<string, HTMLDivElement>());
  
  // Reset the file nodes map when the file or chart list changes
  React.useEffect(() => {
    // Keep the map in sync with actual rendered nodes
    const currentPaths = [...files.map(f => f.filePath), 
      ...charts.flatMap(chart => chart.files.map(f => f.filePath))];
    
    // Remove any stale entries
    for (const path of fileNodesMap.current.keys()) {
      if (!currentPaths.includes(path)) {
        fileNodesMap.current.delete(path);
      }
    }
  }, [files, charts]);
  
  // When selectedFile changes, update the selectedNodeRef
  React.useEffect(() => {
    if (selectedFile?.filePath) {
      console.log("Looking for node with path:", selectedFile.filePath);
      const selectedNode = fileNodesMap.current.get(selectedFile.filePath);
      if (selectedNode) {
        console.log("Found node in map, updating ref");
        selectedNodeRef.current = selectedNode;
      } else {
        console.log("Node not found in map yet");
      }
    }
  }, [selectedFile?.filePath]);

  const renderNode = (node: TreeNode, level: number) => {
    const patchStats = node.type === "file" ?
      getPatchStats(node.contentPending, node.content) : null;
    
    const isSelected = selectedFile?.filePath === node.filePath;

    return (
    <div key={node.filePath}>
      <div
        ref={el => {
          // Store all file nodes in our map for easier access
          if (el && node.type === "file") {
            fileNodesMap.current.set(node.filePath, el);
            
            // If this is the selected node, also update selectedNodeRef
            if (isSelected) {
              selectedNodeRef.current = el;
            }
          }
        }}
        className={`flex items-center py-1 px-2 cursor-pointer rounded-sm group ${isSelected ? `bg-primary/10 text-primary` : theme === "dark" ? "text-gray-300 hover:text-gray-100 hover:bg-dark-border/40" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"}`}
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
              contentPending: rest.contentPending,
              revisionNumber: 0, // Default revision number
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
          {/* For new files (empty content with pending changes) */}
          {patchStats && (patchStats.additions > 0 || patchStats.deletions > 0) ? (
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
          ) : null}
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
      <div ref={treeContainerRef} className="flex-1 overflow-auto p-2">
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
