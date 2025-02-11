import React, { useEffect } from "react";
import { EditorNav } from "../EditorNav";
import { FileBrowser } from "../FileBrowser";
import { RenderedFileBrowser } from "../RenderedFileBrowser";
import { CodeEditor } from "../CodeEditor";
import { useTheme } from "../../../contexts/ThemeContext";
import { EditorView } from "../../../hooks/useEditorView";
import { logger } from "@/lib/utils/logger";
import { WorkspaceFile, Chart, RenderedChart, RenderUpdate } from "@/lib/types/workspace";
import { Session } from "@/lib/types/session";
import type { editor } from "monaco-editor";

interface WorkspaceContainerProps {
  session: Session;
  view: EditorView;
  onViewChange: (newView: EditorView) => void;
  files: WorkspaceFile[];
  charts: Chart[];
  revision: number;
  renderedCharts: RenderedChart[];
  selectedFile?: WorkspaceFile;
  onFileSelect: (file: WorkspaceFile) => void;
  onFileDelete: (path: string) => void;
  editorContent: string;
  onEditorChange: (value: string | undefined) => void;
  isFileTreeVisible: boolean;
  onCommandK?: () => void;
  onFileUpdate?: (file: WorkspaceFile) => void;
  renderUpdates?: RenderUpdate[];
  onRenderSelect?: (chart: RenderedChart, type: 'stdout' | 'stderr' | 'manifests') => void;
  editorRef?: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
}

export function WorkspaceContainer({
  session,
  view,
  onViewChange,
  files,
  charts,
  renderedCharts,
  revision,
  selectedFile,
  onFileSelect,
  onFileDelete,
  editorContent,
  onEditorChange,
  isFileTreeVisible,
  onCommandK,
  onFileUpdate,
  renderUpdates = [],
  onRenderSelect,
  editorRef,
}: WorkspaceContainerProps) {
  const { resolvedTheme } = useTheme();

  const handleViewChange = (newView: EditorView) => {
    onViewChange(newView);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] min-h-0 max-w-[calc(100vw-545px)] overflow-hidden">
      <EditorNav view={view} onViewChange={handleViewChange} />
      <div className="flex-1 flex min-h-0">
        <div className="w-[260px] flex-shrink-0">
          {isFileTreeVisible && (view === "source" ? (
            <FileBrowser
              nodes={files}
              onFileSelect={onFileSelect}
              onFileDelete={onFileDelete}
              selectedFile={selectedFile}
              charts={charts}
            />
          ) : (
            <RenderedFileBrowser
              charts={renderedCharts}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              renderUpdates={renderUpdates}
              onRenderSelect={onRenderSelect}
            />
          ))}
        </div>
        <div className={`w-px ${resolvedTheme === "dark" ? "bg-dark-border" : "bg-gray-200"} flex-shrink-0`} />
        <div className="flex-1 min-w-0 overflow-auto">
          {view === "source" && selectedFile ? (
            <CodeEditor
              session={session}
              file={selectedFile}
              revision={revision}
              theme={resolvedTheme}
              value={editorContent}
              onChange={onEditorChange}
              onCommandK={onCommandK}
              onFileUpdate={onFileUpdate}
              files={files}
              editorRef={editorRef}
            />
          ) : view === "rendered" && editorContent ? (
            <CodeEditor
              session={session}
              revision={revision}
              theme={resolvedTheme}
              value={editorContent}
              onChange={onEditorChange}
              onCommandK={onCommandK}
              files={files}
              editorRef={editorRef}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
