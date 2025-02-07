"use client";

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import Editor from '@monaco-editor/react';
import { Layout, Columns } from 'lucide-react';
import { useCommandMenu } from '@/contexts/CommandMenuContext';

interface ScenarioEditorProps {
  value: string;
  onChange: (value: string) => void;
  referenceValues: string;
}

export function ScenarioEditor({ value, onChange, referenceValues }: ScenarioEditorProps) {
  const { theme } = useTheme();
  const { setIsCommandMenuOpen } = useCommandMenu();
  const [activeTab, setActiveTab] = useState<'values' | 'reference'>('values');
  const [isSplitView, setIsSplitView] = useState(false);

  const handleEditorMount = (editor: import("monaco-editor").editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
    const commandId = 'chartsmith.openCommandPalette';
    editor.addAction({
      id: commandId,
      label: 'Open Command Palette',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      run: () => {
        console.log("Running command palette action in editor");
        setIsCommandMenuOpen(true);
      }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      console.log("Command K triggered in editor");
      setIsCommandMenuOpen(true);
      return null;
    });
  };

  return (
    <div className="h-[700px]">
      <div className={`flex-none flex items-center border-b ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
        {!isSplitView && (
          <>
            <button
              type="button"
              onClick={() => {
                setActiveTab('values');
                setIsSplitView(false);
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'values'
                  ? theme === 'dark'
                    ? 'text-white border-primary'
                    : 'text-gray-900 border-primary'
                  : theme === 'dark'
                    ? 'text-gray-400 border-transparent hover:text-gray-300'
                    : 'text-gray-600 border-transparent hover:text-gray-700'
              }`}
            >
              Scenario values (empty)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('reference');
                setIsSplitView(false);
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'reference'
                  ? theme === 'dark'
                    ? 'text-white border-primary'
                    : 'text-gray-900 border-primary'
                  : theme === 'dark'
                    ? 'text-gray-400 border-transparent hover:text-gray-300'
                    : 'text-gray-600 border-transparent hover:text-gray-700'
              }`}
            >
              Built-in values (reference)
            </button>
          </>
        )}
        <div className="flex items-center ml-auto pr-2 space-x-1">
          <button
            type="button"
            onClick={() => setIsSplitView(false)}
            className={`p-1.5 rounded-lg transition-colors ${
              !isSplitView
                ? theme === 'dark'
                  ? 'text-white bg-dark-border/40'
                  : 'text-gray-900 bg-gray-100'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-dark-border/40'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Layout className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsSplitView(true)}
            className={`p-1.5 rounded-lg transition-colors ${
              isSplitView
                ? theme === 'dark'
                  ? 'text-white bg-dark-border/40'
                  : 'text-gray-900 bg-gray-100'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-dark-border/40'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Columns className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className={`h-[calc(100%-40px)] w-full rounded-b-lg border-x border-b ${theme === "dark" ? "border-dark-border" : "border-gray-300"}`}>
        {isSplitView ? (
          <div className={`grid grid-cols-2 divide-x h-full ${theme === "dark" ? "divide-dark-border" : "divide-gray-200"}`}>
            <div className="h-full">
              <div className={`h-[32px] px-4 py-2 text-sm font-medium border-b ${theme === "dark" ? "border-dark-border text-gray-300" : "border-gray-200 text-gray-700"}`}>
                Scenario values (empty)
              </div>
              <div className="h-[calc(100%-32px)]">
                <Editor
                  key="scenario-editor"
                  height="100%"
                  defaultLanguage="yaml"
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  value={value}
                  onChange={(val) => onChange(val || '')}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 11,
                    lineNumbers: 'on',
                    folding: false,
                    lineDecorationsWidth: 16,
                    lineNumbersMinChars: 3,
                    padding: { top: 8, bottom: 8 }
                  }}
                />
              </div>
            </div>
            <div className="h-full">
              <div className={`h-[32px] px-4 py-2 text-sm font-medium border-b ${theme === "dark" ? "border-dark-border text-gray-300" : "border-gray-200 text-gray-700"}`}>
                Built-in values (reference)
              </div>
              <div className="h-[calc(100%-32px)]">
                <Editor
                  key="reference-editor"
                  height="100%"
                  defaultLanguage="yaml"
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  value={referenceValues}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 11,
                    lineNumbers: 'on',
                    folding: false,
                    lineDecorationsWidth: 16,
                    lineNumbersMinChars: 3,
                    padding: { top: 8, bottom: 8 },
                    readOnly: true
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full">
            <Editor
              key={activeTab}
              height="100%"
              defaultLanguage="yaml"
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              value={activeTab === 'values' ? value : referenceValues}
              onChange={activeTab === 'values' ? (val) => onChange(val || '') : undefined}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 11,
                lineNumbers: 'on',
                folding: false,
                lineDecorationsWidth: 16,
                lineNumbersMinChars: 3,
                padding: { top: 8, bottom: 8 },
                readOnly: activeTab === 'reference'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
