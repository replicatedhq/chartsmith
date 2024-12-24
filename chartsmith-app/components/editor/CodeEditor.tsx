import React from 'react';
import Editor from '@monaco-editor/react';
import type { FileNode } from './types';
import { useMonacoEditor } from '../../hooks/useMonacoEditor';

interface CodeEditorProps {
  file?: FileNode;
  theme?: 'light' | 'dark';
  value?: string;
  onChange?: (value: string | undefined) => void;
}

export function CodeEditor({ file, theme = 'light', value, onChange }: CodeEditorProps) {
  const { handleEditorInit } = useMonacoEditor(file);

  return (
    <div className="flex-1 h-full">
      <Editor
        height="100%"
        defaultLanguage="yaml"
        language="yaml"
        value={value ?? ''}
        onChange={onChange}
        theme={theme === 'light' ? 'vs' : 'vs-dark'}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          readOnly: !onChange,
          glyphMargin: true,
          lineDecorationsWidth: 5,
          renderLineHighlight: 'all',
          folding: true,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          fixedOverflowWidgets: true,
          overviewRulerBorder: false,
          overviewRulerLanes: 2,
          hideCursorInOverviewRuler: true
        }}
        onMount={handleEditorInit}
        key={`${file?.path}-${theme}`} // Force re-mount when file or theme changes
      />
    </div>
  );
}
