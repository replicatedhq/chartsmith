"use client";

import React, { useState } from "react";
import { EditorNav } from "../EditorNav";
import { FileBrowser } from "../FileBrowser";
import { RenderedFileBrowser } from "../RenderedFileBrowser";
import { CodeEditor } from "../CodeEditor";
import { useTheme } from "../../../contexts/ThemeContext";
import { EditorView } from "../../../hooks/useEditorView";
import { FileNode } from "@/lib/types/files";
import { AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";

interface WorkspaceContainerProps {
  view: EditorView;
  onViewChange: (newView: EditorView) => void;
  files: FileNode[];
  renderedFiles: FileNode[];
  selectedFile?: FileNode;
  onFileSelect: (file: FileNode) => void;
  onFileDelete: (path: string) => void;
  editorContent: string;
  onEditorChange: (value: string | undefined) => void;
  isFileTreeVisible: boolean;
}

export function WorkspaceContainer({ view, onViewChange, files, renderedFiles, selectedFile, onFileSelect, onFileDelete, editorContent, onEditorChange, isFileTreeVisible }: WorkspaceContainerProps) {
  const { theme } = useTheme();
  const [showNotImplementedModal, setShowNotImplementedModal] = useState(false);

  const handleViewChange = () => {
    const newView = view === "source" ? "rendered" : "source";

    if (newView === "rendered") {
      setShowNotImplementedModal(true);
    } else {
      onViewChange(newView);
    }
  };

  return (
    <>
      <div className="flex-1 flex flex-col h-full min-h-0">
        <EditorNav view={view} onViewChange={handleViewChange} />
        <div className="flex-1 flex min-h-0">
          {isFileTreeVisible && (view === "source" ? <FileBrowser nodes={files} onFileSelect={onFileSelect} onFileDelete={onFileDelete} selectedFile={selectedFile} /> : <RenderedFileBrowser nodes={renderedFiles} onFileSelect={onFileSelect} selectedFile={selectedFile} />)}
          <div className={`w-px ${theme === "dark" ? "bg-dark-border" : "bg-gray-200"} flex-shrink-0`} />
          <div className="flex-1 min-w-0 w-full">
            <CodeEditor file={selectedFile} theme={theme} value={editorContent} onChange={onEditorChange} />
          </div>
        </div>
      </div>

      {showNotImplementedModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNotImplementedModal(false);
            }
          }}
        >
          <div className={`w-full max-w-md rounded-lg shadow-lg border p-6 ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                Not Yet Implemented
              </h2>
            </div>
            <p className={`${theme === "dark" ? "text-gray-300" : "text-gray-600"} mb-6`}>
              The rendered YAML view is not yet implemented. This feature is coming soon!
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowNotImplementedModal(false)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${theme === "dark" ? "text-gray-300 hover:text-white bg-dark-border/40 hover:bg-dark-border/60" : "text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200"}`}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
