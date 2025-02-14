"use client";

import React from "react";
import { useAtom } from "jotai";

// atoms
import { editorViewAtom, selectedFileAtom } from "@/atoms/editor";
import { looseFilesAtom, workspaceAtom } from "@/atoms/workspace";

// components
import { FileBrowser } from "@/components/FileBrowser";
import { CodeEditor } from "@/components/CodeEditor";

// contexts
import { useTheme } from "@/contexts/ThemeContext";

// types
import { RenderedFile } from "@/lib/types/workspace";
import { Session } from "@/lib/types/session";
import { Button } from "@/components/ui/Button";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";

interface WorkspaceContainerClientProps {
  session: Session;
  editorContent: string;
  onEditorChange: (value: string | undefined) => void;
  onCommandK?: () => void;
}

export function WorkspaceContainerClient({
  session,
  editorContent,
  onEditorChange,
  onCommandK,
}: WorkspaceContainerClientProps) {
  const { resolvedTheme } = useTheme();
  const [selectedFile] = useAtom(selectedFileAtom);
  const [workspace] = useAtom(workspaceAtom);
  const [looseFiles] = useAtom(looseFilesAtom);
  const [view, setView] = useAtom(editorViewAtom);

  if (!workspace) {
    return null;
  }

  const renderedFiles: RenderedFile[] = [];

  return (
    <div
      data-testid="workspace-container"
      className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] min-h-0 max-w-[calc(100vw-545px)] overflow-hidden"
    >
      <div className="flex-1 flex min-h-0">
        <div className="w-[260px] flex-shrink-0">
          <FileBrowser />
        </div>
        <div className={`w-px ${resolvedTheme === "dark" ? "bg-dark-border" : "bg-gray-200"} flex-shrink-0`} />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center px-2 border-b border-dark-border/40 bg-dark-surface/40">
            <div
              onClick={() => setView("source")}
              className={`px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors relative group ${
                view === "source"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {view === "source" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
              Source
            </div>
            <div
              onClick={() => setView("rendered")}
              className={`px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors relative group ${
                view === "rendered"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {view === "rendered" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
              Rendered
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {view === "rendered" && selectedFile && !renderedFiles.find(rf => rf.filePath === selectedFile.filePath) ? (
              <div className="flex flex-col items-center justify-center h-full text-sm text-gray-500 space-y-2">
                <div>This file was not included in the rendered output</div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    await createChatMessageAction(session, workspace.id, `Why was the file ${selectedFile.filePath} not included in the rendered output?`);
                  }}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  Why was this file not included?
                </Button>
              </div>
            ) : (
              selectedFile && (
                <CodeEditor
                  session={session}
                  theme={resolvedTheme}
                  value={editorContent}
                  onChange={onEditorChange}
                  onCommandK={onCommandK}
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
