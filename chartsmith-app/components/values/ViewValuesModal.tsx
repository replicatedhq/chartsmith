import React, { useEffect, useState } from 'react';
import { X, Layout, Columns } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Scenario } from '@/lib/types/workspace';
import Editor from '@monaco-editor/react';

interface ViewValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: Scenario | null;
  onUpdate?: (scenario: Scenario) => void;
}

export function ViewValuesModal({ isOpen, onClose, scenario, onUpdate }: ViewValuesModalProps) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'values' | 'reference'>('values');
  const [isSplitView, setIsSplitView] = useState(false);

  useEffect(() => {
    if (scenario) {
      setName(scenario.name);
      setDescription(scenario.description);
      setEnabled(scenario.enabled ?? true);
    }
  }, [scenario]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => {
        window.removeEventListener('keydown', handleEsc);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !scenario) return null;

  const handleSave = () => {
    if (onUpdate && scenario) {
      onUpdate({
        ...scenario,
        name,
        description,
        enabled
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-3xl h-[700px] rounded-lg shadow-lg border flex flex-col ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>Edit Values Scenario</h2>
          <button
            onClick={onClose}
            className={`${
              theme === 'dark'
                ? 'text-gray-400 hover:text-white'
                : 'text-gray-500 hover:text-gray-700'
            } transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-6 pb-8 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-[3]">
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-dark border-dark-border text-gray-300'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                required
              />
            </div>
            <div className="flex-1 pt-8">
              <label className={`flex items-center justify-end gap-2 text-sm font-medium ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <span>Enabled</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => setEnabled(!enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enabled
                      ? 'bg-primary'
                      : theme === 'dark'
                        ? 'bg-dark-border/40'
                        : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </label>
            </div>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-dark border-dark-border text-gray-300'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>
          <div>
            <div>
              <div className={`flex items-center border-b ${
                theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
              }`}>
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
                      Scenario values (to test)
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
              <div className={`w-full rounded-b-lg border-x border-b ${
                theme === 'dark'
                  ? 'border-dark-border'
                  : 'border-gray-300'
              }`}>
                {isSplitView ? (
                  <div className={`grid grid-cols-2 divide-x ${
                    theme === 'dark' ? 'divide-dark-border' : 'divide-gray-200'
                  }`}>
                    <div>
                      <div className={`px-4 py-2 text-sm font-medium border-b ${
                        theme === 'dark' ? 'border-dark-border text-gray-300' : 'border-gray-200 text-gray-700'
                      }`}>
                        Scenario values (to test)
                      </div>
                      <Editor
                        height="300px"
                        defaultLanguage="yaml"
                        theme={theme === 'dark' ? 'vs-dark' : 'light'}
                        value={scenario.values}
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
                    <div>
                      <div className={`px-4 py-2 text-sm font-medium border-b ${
                        theme === 'dark' ? 'border-dark-border text-gray-300' : 'border-gray-200 text-gray-700'
                      }`}>
                        Built-in values (reference)
                      </div>
                      <Editor
                        height="300px"
                        defaultLanguage="yaml"
                        theme={theme === 'dark' ? 'vs-dark' : 'light'}
                        value={`# Default values for my-helm-chart
replicaCount: 1
image:
  repository: nginx
  tag: "1.16.0"
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 80`}
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
                ) : (
                  <div>
                    <Editor
                      height="300px"
                      defaultLanguage="yaml"
                      theme={theme === 'dark' ? 'vs-dark' : 'light'}
                      value={activeTab === 'values' ? scenario.values : `# Default values for my-helm-chart
replicaCount: 1
image:
  repository: nginx
  tag: "1.16.0"
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 80`}
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
                )}
              </div>
            </div>
          </div>
        </div>
        <div className={`p-4 border-t ${theme === 'dark' ? 'border-dark-border' : 'border-gray-200'} mt-auto`}>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'text-gray-300 hover:text-white bg-dark-border/40 hover:bg-dark-border/60'
                  : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
