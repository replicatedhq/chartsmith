"use client";

import React, { useRef, useEffect } from "react";
import type { editor } from "monaco-editor";
import type { WorkspaceFile } from "@/lib/types/workspace";

// Global registry for Monaco models
declare global {
  interface Window {
    __monaco?: any;
    __monacoEditor?: editor.IStandaloneCodeEditor;
    __monacoModels?: {
      [key: string]: editor.ITextModel;
    };
  }
}

// Ultra simple and reliable diff parser that extracts only the final content
export function parseDiff(originalContent: string, diffContent: string): string {
  // For empty diffs, return original content
  if (!diffContent || diffContent.trim() === '') {
    return originalContent;
  }
  
  // For new files (empty original content), extract only the added lines
  if (originalContent === '' || diffContent.includes('@@ -0,0 +1,')) {
    const newContent = diffContent
      .split('\n')
      .filter(line => line.startsWith('+') && !line.startsWith('+++'))
      .map(line => line.substring(1))
      .join('\n');
    
    if (newContent) {
      return newContent;
    }
  }
  
  // Direct text replacement for common fixes
  // Handle specific line replacements in YAML/JSON
  const replacementMatches = Array.from(diffContent.matchAll(/-([^:\n]+):\s*([^\n]+)\n\+([^:\n]+):\s*([^\n]+)/g));
  if (replacementMatches.length === 1) {
    const match = replacementMatches[0];
    const oldKey = match[1].trim();
    const oldValue = match[2].trim();
    const newKey = match[3].trim(); 
    const newValue = match[4].trim();
    
    // If it's a direct value replacement (same key)
    if (oldKey === newKey) {
      const searchPattern = `${oldKey}: ${oldValue}`;
      const replacement = `${newKey}: ${newValue}`;
      if (originalContent.includes(searchPattern)) {
        return originalContent.replace(searchPattern, replacement);
      }
    }
  }
  
  try {
    // Last resort: extract the entire modified file content directly
    // Look for a complete rendered version in the diff
    const completeDiffMatch = diffContent.match(/\n--- [\s\S]*?\n\+\+\+ [\s\S]*?\n((?:@@ [\s\S]*? @@[\s\S]*?\n)+)((?: [\s\S]*\n|\+[\s\S]*\n|-[\s\S]*\n)*)/);
    if (completeDiffMatch) {
      const hunkContent = completeDiffMatch[2].split('\n');
      
      // Just extract all kept and added lines (starting with ' ' or '+')
      // and skip all removed lines (starting with '-')
      const keptContent = hunkContent
        .filter(line => line.startsWith(' ') || line.startsWith('+'))
        .map(line => line.substring(1))
        .join('\n');
      
      if (keptContent) {
        return keptContent;
      }
    }
    
    // Simple string replacement if recognizable patterns exist
    const singleLineDiffMatch = diffContent.match(/-([^\n]+)\n\+([^\n]+)/);
    if (singleLineDiffMatch) {
      const oldLine = singleLineDiffMatch[1];
      const newLine = singleLineDiffMatch[2];
      
      // Try direct string replacement
      const lines = originalContent.split('\n');
      const index = lines.findIndex(line => line.trim() === oldLine.trim());
      if (index !== -1) {
        lines[index] = newLine;
        return lines.join('\n');
      }
    }
    
    // Last resort: just attempt direct string replacement
    const minusParts = diffContent.match(/^-(.*)$/gm);
    const plusParts = diffContent.match(/^\+(.*)$/gm);
    
    if (minusParts && plusParts && minusParts.length === plusParts.length) {
      let content = originalContent;
      
      for (let i = 0; i < minusParts.length; i++) {
        const minusLine = minusParts[i].substring(1);
        const plusLine = plusParts[i].substring(1);
        
        content = content.replace(minusLine, plusLine);
      }
      
      return content;
    }
    
    // Ultimate fallback
    return originalContent;
  } catch (error) {
    console.error("Error parsing diff:", error);
    return originalContent;
  }
}

// Helper function for better error handling in Monaco
export function setupSafeMonacoCleanup(): void {
  // This runs once when the module is loaded
  if (typeof window !== 'undefined') {
    // Add event listener for beforeunload to clean up Monaco resources properly
    window.addEventListener('beforeunload', () => {
      try {
        // Try to clean up Monaco models on page unload
        if ((window as any).monaco?.editor) {
          const models = (window as any).monaco.editor.getModels();
          models.forEach((model: any) => {
            if (!model.isDisposed()) {
              try {
                model.dispose();
              } catch (e) {
                // Ignore errors
              }
            }
          });
        }
      } catch (e) {
        // Ignore any errors during cleanup on page unload
      }
    });
  }
}

// Get language from file extension
export function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'txt':
      return 'plaintext';
    default:
      return 'plaintext';
  }
}

// Custom hook for Monaco Editor with single instance approach
export function useMonacoSingleInstance(
  selectedFile: WorkspaceFile | null,
  editorRef: React.RefObject<editor.IStandaloneCodeEditor>,
  monacoRef: React.RefObject<typeof import("monaco-editor")>,
  editorOptions: any,
  onContentChange: (content: string) => void,
  theme: "light" | "dark",
  readOnly: boolean,
  editorContainerRef: React.RefObject<HTMLDivElement>
) {
  // Track if we're in diff mode
  const [inDiffMode, setInDiffMode] = React.useState(false);
  
  // Track previous values to prevent loading flicker
  const prevContentRef = useRef<string | undefined>(undefined);
  
  // Calculate derived state
  const original = selectedFile?.content || '';
  const language = getLanguage(selectedFile?.filePath || '');
  
  // Extract modified content from diff
  const modifiedContent = React.useMemo(() => {
    if (!selectedFile?.pendingPatch) return "";
    
    try {
      return parseDiff(selectedFile.content, selectedFile.pendingPatch);
    } catch (error) {
      console.error("Error parsing diff:", error);
      return selectedFile.pendingPatch;
    }
  }, [selectedFile?.content, selectedFile?.pendingPatch]);

  // Add effect to update models when file or diff mode changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !selectedFile) return;
    
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    
    // Get file info
    const fileKey = selectedFile.id || selectedFile.filePath || 'unknown';
    const isDiffMode = !!selectedFile.pendingPatch;
    
    // Set the diff mode state
    setInDiffMode(isDiffMode);
    
    // Get or create a text model for this file
    let model = window.__monacoModels?.[fileKey];
    if (!model) {
      const uri = monaco.Uri.parse(`file:///${fileKey}`);
      model = monaco.editor.createModel(
        selectedFile.content || '', 
        language, 
        uri
      );
      if (window.__monacoModels) {
        window.__monacoModels[fileKey] = model;
      }
    } else {
      // Update existing model if content changed
      if (model.getValue() !== selectedFile.content) {
        model.setValue(selectedFile.content || '');
      }
    }
    
    // Handle diff mode or regular mode
    if (isDiffMode) {
      // Create a modified model for the diff
      const modifiedKey = `${fileKey}-modified`;
      let modifiedModel = window.__monacoModels?.[modifiedKey];
      
      if (!modifiedModel) {
        const uri = monaco.Uri.parse(`file:///${modifiedKey}`);
        modifiedModel = monaco.editor.createModel(
          modifiedContent, 
          language, 
          uri
        );
        if (window.__monacoModels) {
          window.__monacoModels[modifiedKey] = modifiedModel;
        }
      } else {
        modifiedModel.setValue(modifiedContent);
      }
      
      // If we have a container, create a diff editor
      if (editorContainerRef.current) {
        // Set up diff editor config
        const diffOptions = {
          ...editorOptions,
          readOnly: true,
          renderSideBySide: false,
          originalEditable: false,
          modifiedEditable: false
        };
        
        try {
          // Use editor API to create diff view with our models
          monaco.editor.createDiffEditor(
            editorContainerRef.current, 
            diffOptions
          ).setModel({
            original: model,
            modified: modifiedModel
          });
        } catch (e) {
          console.error("Error creating diff editor:", e);
        }
      }
    } else {
      // Regular editor mode - just update the model
      editor.setModel(model);
      
      // Update editor options
      editor.updateOptions({
        ...editorOptions,
        readOnly: readOnly
      });
      
      // Setup change handler for regular mode
      const changeDisposable = model.onDidChangeContent(() => {
        onContentChange(model.getValue());
      });
      
      // Cleanup
      return () => {
        changeDisposable.dispose();
      };
    }
  }, [
    selectedFile?.id, 
    selectedFile?.content, 
    selectedFile?.pendingPatch, 
    readOnly, 
    language, 
    modifiedContent, 
    editorRef, 
    monacoRef, 
    editorContainerRef,
    editorOptions,
    onContentChange
  ]);

  // Keep previous content in sync with current selection
  useEffect(() => {
    if (selectedFile?.content) {
      prevContentRef.current = selectedFile.content;
    }
  }, [selectedFile?.content]);

  // Initialize Monaco environment
  useEffect(() => {
    // Call setup function 
    setupSafeMonacoCleanup();
    
    // Set up global model registry if not exists
    if (typeof window !== 'undefined' && !window.__monacoModels) {
      window.__monacoModels = {};
    }
  }, []);

  return {
    original,
    language,
    modifiedContent,
    inDiffMode,
    setInDiffMode
  };
}