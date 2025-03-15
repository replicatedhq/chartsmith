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
    if (!selectedFile?.pendingPatches || selectedFile.pendingPatches.length === 0) return "";
    
    try {
      // Use the first patch in the array
      return parseDiff(selectedFile.content, selectedFile.pendingPatches[0]);
    } catch (error) {
      console.error("Error parsing diff:", error);
      return selectedFile.pendingPatches?.[0] || "";
    }
  }, [selectedFile?.content, selectedFile?.pendingPatches]);

  // Simplified effect that handles model creation only
  // We now rely on React's key mechanism to unmount/remount editors
  useEffect(() => {
    if (!monacoRef.current || !selectedFile) return;
    
    const monaco = monacoRef.current;
    
    // Get file info
    const fileKey = selectedFile.id || selectedFile.filePath || 'unknown';
    const isDiffMode = !!selectedFile.pendingPatches && selectedFile.pendingPatches.length > 0;
    
    // Set the diff mode state - this should happen before any model changes
    setInDiffMode(isDiffMode);
    
    // Check if editor is available - might not be available during transitions
    if (!editorRef.current) {
      console.log("Editor reference not available, skipping model update");
      return;
    }
    
    // For non-diff mode, setting up the editor model is simpler
    if (!isDiffMode && editorRef.current) {
      try {
        // For regular editor, we still maintain the model for consistent history
        const editor = editorRef.current;
        
        // We need to be careful with model management to avoid 'disposed before reset' errors
        // Check if we already have a model for this file
        let model = window.__monacoModels?.[fileKey];
        
        // If no model exists or it's been disposed, create a new one
        if (!model || model.isDisposed()) {
          try {
            const uri = monaco.Uri.parse(`file:///${fileKey}`);
            model = monaco.editor.createModel(
              selectedFile.content || '', 
              language, 
              uri
            );
            if (window.__monacoModels) {
              window.__monacoModels[fileKey] = model;
            }
          } catch (modelError) {
            console.warn("Error creating model:", modelError);
          }
        } else {
          // Update existing model if content changed
          try {
            if (model.getValue() !== selectedFile.content) {
              model.setValue(selectedFile.content || '');
            }
          } catch (updateError) {
            console.warn("Error updating model value:", updateError);
          }
        }
        
        // Only set the model if we have a valid one and the editor is still available
        if (model && !model.isDisposed() && editor) {
          try {
            editor.setModel(model);
          } catch (setModelError) {
            console.warn("Error setting model on editor:", setModelError);
          }
        }
      } catch (error) {
        console.warn("Error in Monaco model management:", error);
        // Just log errors, don't try to manipulate references
      }
    }
    // For diff mode, the DiffEditor component will handle model creation
  }, [
    selectedFile?.id, 
    selectedFile?.content, 
    selectedFile?.pendingPatches, 
    language, 
    editorRef, 
    monacoRef
  ]);

  // Keep previous content in sync with current selection
  useEffect(() => {
    if (selectedFile?.content) {
      prevContentRef.current = selectedFile.content;
    }
  }, [selectedFile?.content]);
  
  // Force immediate diff mode update when pendingPatches changes
  // This ensures we render the correct editor type instantly
  useEffect(() => {
    if (selectedFile) {
      setInDiffMode(!!selectedFile.pendingPatches && selectedFile.pendingPatches.length > 0);
    }
  }, [selectedFile?.pendingPatches, setInDiffMode]);

  // Initialize Monaco environment and create a safer cleanup process
  useEffect(() => {
    // Call setup function 
    setupSafeMonacoCleanup();
    
    // Set up global model registry if not exists
    if (typeof window !== 'undefined' && !window.__monacoModels) {
      window.__monacoModels = {};
    }
    
    // Define a safer model cleanup function
    const cleanupModels = () => {
      // We'll only cleanup models that no longer have an editor using them
      if (typeof window !== 'undefined' && window.__monacoModels) {
        Object.keys(window.__monacoModels).forEach(key => {
          const model = window.__monacoModels?.[key];
          if (model && !model.isDisposed()) {
            try {
              // Track all available editors
              const allEditors = monacoRef.current?.editor.getEditors() || [];
              const diffEditors = monacoRef.current?.editor.getDiffEditors() || [];
              
              // Check if any editor is using this model
              const isModelInUse = allEditors.some(editor => 
                editor.getModel() === model
              ) || diffEditors.some(diffEditor => {
                const original = diffEditor.getOriginalEditor().getModel();
                const modified = diffEditor.getModifiedEditor().getModel();
                return original === model || modified === model;
              });
              
              // Only dispose if not in use
              if (!isModelInUse) {
                model.dispose();
                delete window.__monacoModels[key];
              }
            } catch (e) {
              console.warn("Error checking model usage:", e);
            }
          }
        });
      }
    };
    
    // Set up an interval to clean unused models periodically
    const cleanupInterval = setInterval(cleanupModels, 30000); // Every 30 seconds
    
    // Cleanup function to run when component unmounts
    return () => {
      // Clear the cleanup interval
      clearInterval(cleanupInterval);
      
      // Don't manually set editorRef to null here - let React handle it
      // This prevents the "disposed before reset" error
    };
  }, [monacoRef]);

  return {
    original,
    language,
    modifiedContent,
    inDiffMode,
    setInDiffMode
  };
}