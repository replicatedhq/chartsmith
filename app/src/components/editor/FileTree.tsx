import React from 'react';
import { FolderOpen, FileText, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { FileNode } from './types';
import { useTheme } from '../../contexts/ThemeContext';
import { DeleteFileModal } from '../modals/DeleteFileModal';

interface FileTreeProps {
  nodes: FileNode[];
  level?: number;
  onFileSelect: (file: FileNode) => void;
  onFileDelete: (path: string) => void;
  selectedFile?: FileNode;
}

export function FileTree({ nodes, level = 0, onFileSelect, onFileDelete, selectedFile }: FileTreeProps) {
  const { theme } = useTheme();
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(
    new Set(['my-helm-chart', 'my-helm-chart/templates'])
  );
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const [deleteModal, setDeleteModal] = React.useState<{
    isOpen: boolean;
    filePath: string;
    isRequired: boolean;
  }>({
    isOpen: false,
    filePath: '',
    isRequired: false
  });

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
      const fileName = node.path.split('/').pop();
      const isRequired = fileName === 'Chart.yaml' || fileName === 'values.yaml';
      
      setDeleteModal({
        isOpen: true,
        filePath: node.path,
        isRequired
      });
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteModal.isRequired && deleteModal.filePath) {
      onFileDelete(deleteModal.filePath);
    }
    setDeleteModal({ isOpen: false, filePath: '', isRequired: false });
  };

  return (
    <>
      <div style={{ paddingLeft: level ? '1rem' : '0' }}>
        {nodes.map((node) => (
          <div key={node.path || node.name}>
            <div
              className={`flex items-center py-1 px-2 cursor-pointer rounded-sm group ${
                selectedFile?.path === node.path 
                  ? `bg-primary/10 text-primary` 
                  : theme === 'dark'
                    ? 'text-gray-300 hover:text-gray-100 hover:bg-dark-border/40'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
              }`}
              onClick={() => {
                if (node.type === 'folder') {
                  toggleFolder(node.path || node.name);
                } else {
                  onFileSelect(node);
                }
              }}
              onMouseEnter={() => setHoveredItem(node.path || node.name)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <span className="w-4 h-4 mr-1">
                {node.type === 'folder' && (
                  expandedFolders.has(node.path || node.name) 
                    ? <ChevronDown className="w-4 h-4" /> 
                    : <ChevronRight className="w-4 h-4" />
                )}
              </span>
              {node.type === 'folder' ? (
                <FolderOpen 
                  className={`w-4 h-4 mr-2 ${
                    expandedFolders.has(node.path || node.name) 
                      ? 'text-primary' 
                      : theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                  }`} 
                />
              ) : (
                <FileText 
                  className={`w-4 h-4 mr-2 ${
                    selectedFile?.path === node.path 
                      ? 'text-primary' 
                      : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`} 
                />
              )}
              <span className="text-sm flex-1">{node.name}</span>
              {hoveredItem === (node.path || node.name) && node.type === 'file' && (
                <button
                  onClick={(e) => handleDelete(node, e)}
                  className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                    theme === 'dark'
                      ? 'hover:bg-dark-border/60 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            {node.type === 'folder' && 
             expandedFolders.has(node.path || node.name) && 
             node.children && (
              <FileTree 
                nodes={node.children} 
                level={level + 1} 
                onFileSelect={onFileSelect}
                onFileDelete={onFileDelete}
                selectedFile={selectedFile}
              />
            )}
          </div>
        ))}
      </div>

      <DeleteFileModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, filePath: '', isRequired: false })}
        filePath={deleteModal.filePath}
        isRequired={deleteModal.isRequired}
      />
    </>
  );
}