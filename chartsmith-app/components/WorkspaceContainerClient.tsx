"use client";

import React from "react";
import { useAtom } from "jotai";
import { FileText } from "lucide-react";
import Editor from "@monaco-editor/react";

// atoms
import { editorViewAtom, selectedFileAtom, renderedFilesAtom } from "@/atoms/workspace";
import { looseFilesAtom, workspaceAtom } from "@/atoms/workspace";

// components
import { FileBrowser } from "@/components/FileBrowser";
import { CodeEditor } from "@/components/CodeEditor";
import { DebugPanel } from "@/components/DebugPanel";

// contexts
import { useTheme } from "@/contexts/ThemeContext";
import { useCommandMenu } from "@/contexts/CommandMenuContext";

// types
import { RenderedFile } from "@/lib/types/workspace";
import { Session } from "@/lib/types/session";
import { Button } from "@/components/ui/Button";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";

interface WorkspaceContainerClientProps {
  session: Session;
  editorContent: string;
  onCommandK?: () => void;
}

export function WorkspaceContainerClient({
  session,
  editorContent,
  onCommandK,
}: WorkspaceContainerClientProps) {
  const { resolvedTheme } = useTheme();
  const { isDebugVisible } = useCommandMenu();
  const [selectedFile] = useAtom(selectedFileAtom);
  const [workspace] = useAtom(workspaceAtom);
  const [looseFiles] = useAtom(looseFilesAtom);
  const [view, setView] = useAtom(editorViewAtom);
  const [renderedFiles] = useAtom(renderedFilesAtom);



  if (!workspace) {
    return null;
  }

  return (
    <>
      <div
        data-testid="workspace-container"
        className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] min-h-0 max-w-[calc(100vw-545px)] overflow-hidden"
      >
        <div className="flex-1 flex min-h-0">
          <div className="w-[260px] flex-shrink-0">
            <FileBrowser />
          </div>
          <div className={`w-px ${resolvedTheme === "dark" ? "bg-dark-border" : "bg-gray-200"} flex-shrink-0`} />
          <div className={`flex-1 min-w-0 flex flex-col ${isDebugVisible ? 'pr-[25%]' : ''}`}>
            <div className={`flex items-center px-2 border-b ${
              resolvedTheme === "dark" ? "border-dark-border/40 bg-dark-surface/40" : "border-gray-200 bg-white"
            }`}>
              <div
                onClick={() => setView("source")}
                className={`px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors relative group ${
                  view === "source"
                    ? resolvedTheme === "dark" ? "text-primary" : "text-primary-foreground"
                    : resolvedTheme === "dark" ? "text-gray-500 hover:text-gray-300" : "text-gray-600 hover:text-gray-900"
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
                    ? resolvedTheme === "dark" ? "text-primary" : "text-primary-foreground"
                    : resolvedTheme === "dark" ? "text-gray-500 hover:text-gray-300" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {view === "rendered" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
                Rendered
              </div>
            </div>
            <div className="flex-1 h-full overflow-auto">
              {view === "rendered" ? (
                selectedFile ? (
                  // Try to find a rendered version of the selected file
                  (() => {
                    let renderedFile = null;

                    // Try exact match first
                    renderedFile = renderedFiles.find(rf => rf.filePath === selectedFile.filePath);

                    // If no exact match, look for a rendered file with a matching name
                    if (!renderedFile) {
                      const selectedFileName = selectedFile.filePath.split('/').pop() || '';
                      renderedFile = renderedFiles.find(rf => {
                        const renderedFileName = rf.filePath.split('/').pop() || '';
                        return renderedFileName === selectedFileName;
                      });
                    }

                    // Special handling for templates
                    if (!renderedFile && selectedFile.filePath.includes('/templates/')) {
                      // For template files, look for a corresponding YAML file in the rendered output
                      const baseFileName = selectedFile.filePath.split('/').pop()?.replace('.yaml.tpl', '.yaml').replace('.tpl', '') || '';

                      renderedFile = renderedFiles.find(rf => {
                        const renderedFileName = rf.filePath.split('/').pop() || '';
                        return renderedFileName === baseFileName;
                      });

                    }

                    // If we find a rendered version, show it
                    if (renderedFile) {
                      // Get the rendered content
                      const renderedContent = renderedFile.renderedContent || "";

                      // Use a unique key to force the CodeEditor to fully remount with new content
                      // This prevents old content from persisting in Monaco Editor
                      // Use direct Monaco Editor instance instead of CodeEditor component
                      // to completely avoid any potential state issues
                      return (
                        <div key={`rendered-${renderedFile.id}-${Date.now()}`} className="h-full">
                          <Editor
                            height="100%"
                            defaultLanguage="yaml"
                            language="yaml"
                            value={renderedContent}
                            theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
                            options={{
                              readOnly: true,
                              minimap: { enabled: false },
                              fontSize: 11,
                              lineNumbers: 'on',
                              scrollBeyondLastLine: false,
                              automaticLayout: true,
                              tabSize: 2
                            }}
                          />
                        </div>
                      );
                    } else {
                      // Show a message if this file isn't in rendered output
                      return (
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
                      );
                    }
                  })()
                ) : (
                  // If no file is selected, show a message
                  <div className="flex flex-col items-center justify-center h-full text-sm text-gray-500">
                    <div>Select a file to view its rendered output</div>
                  </div>
                )
              ) : (
                // Source view - show the regular editor
                selectedFile && (
                  <div key={`source-${selectedFile.id}-${view}`} className="h-full">
                    <CodeEditor
                      session={session}
                      theme={resolvedTheme}
                      onCommandK={onCommandK}
                    />
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <DebugPanel isVisible={isDebugVisible} />
    </>
  );
}
