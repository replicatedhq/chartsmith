import React from "react";
import { EditorNav } from "../EditorNav";
import { FileBrowser } from "../FileBrowser";
import { RenderedFileBrowser } from "../RenderedFileBrowser";
import { CodeEditor } from "../CodeEditor";
import { useTheme } from "../../../contexts/ThemeContext";
import { EditorView } from "../../../hooks/useEditorView";
import { FileNode } from "@/lib/types/files";

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
  const { resolvedTheme } = useTheme();

  const handleViewChange = () => {
    const newView = view === "source" ? "rendered" : "source";
    onViewChange(newView);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      <EditorNav view={view} onViewChange={handleViewChange} />
      <div className="flex-1 flex min-h-0">
        {isFileTreeVisible && (view === "source" ? <FileBrowser nodes={files} onFileSelect={onFileSelect} onFileDelete={onFileDelete} selectedFile={selectedFile} /> : <RenderedFileBrowser nodes={renderedFiles} onFileSelect={onFileSelect} selectedFile={selectedFile} />)}
        <div className={`w-px ${resolvedTheme === "dark" ? "bg-dark-border" : "bg-gray-200"} flex-shrink-0`} />
        <div className="flex-1 min-w-0 w-full">
          <CodeEditor file={selectedFile} theme={resolvedTheme} value={editorContent} onChange={onEditorChange} />
        </div>
      </div>
    </div>
  );
}
