"use client"

import React, { useState, useRef } from 'react';
import { X, Upload, Sparkles, FileQuestion, Send } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface CreateChartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateChartModal({ isOpen, onClose }: CreateChartModalProps) {
  const { theme } = useTheme();
  const [selectedOption, setSelectedOption] = useState<'prompt' | 'upload' | 'replicated' | null>(null);
  const [selectedApp, setSelectedApp] = useState('');
  const [selectedChart, setSelectedChart] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const apps = ['SlackerNews', 'Other App'];
  const charts = ['nginx-chart', 'redis-ha', 'mongodb-cluster'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Handle file upload
      console.log('Uploading file:', file.name);
    }
  };

  const handlePromptSubmit = () => {
    if (promptInput.trim()) {
      // Handle prompt submission
      console.log('Submitting prompt:', promptInput);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-2xl rounded-lg shadow-lg border ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark'
            ? 'border-dark-border'
            : 'border-gray-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Create New Chart
          </h2>
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

        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            {/* Prompt Option */}
            <button
              onClick={() => setSelectedOption('prompt')}
              className={`p-6 rounded-lg border transition-colors flex flex-col items-center text-center ${
                selectedOption === 'prompt'
                  ? 'border-primary bg-primary/5'
                  : theme === 'dark'
                    ? 'border-dark-border hover:border-primary/50 bg-dark/40'
                    : 'border-gray-200 hover:border-primary/50 bg-gray-50'
              }`}
            >
              <Sparkles className={`w-8 h-8 mb-4 ${
                selectedOption === 'prompt' ? 'text-primary' : 'text-gray-400'
              }`} />
              <h3 className={`font-medium mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Prompt to Start
              </h3>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Describe your application and let AI generate a chart
              </p>
            </button>

            {/* Upload Option */}
            <button
              onClick={() => {
                setSelectedOption('upload');
                fileInputRef.current?.click();
              }}
              className={`p-6 rounded-lg border transition-colors flex flex-col items-center text-center ${
                selectedOption === 'upload'
                  ? 'border-primary bg-primary/5'
                  : theme === 'dark'
                    ? 'border-dark-border hover:border-primary/50 bg-dark/40'
                    : 'border-gray-200 hover:border-primary/50 bg-gray-50'
              }`}
            >
              <Upload className={`w-8 h-8 mb-4 ${
                selectedOption === 'upload' ? 'text-primary' : 'text-gray-400'
              }`} />
              <h3 className={`font-medium mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Upload Chart
              </h3>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Upload an existing Helm chart
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".tgz,.tar.gz"
                className="hidden"
                onChange={handleFileUpload}
              />
            </button>

            {/* Replicated Option */}
            <button
              onClick={() => setSelectedOption('replicated')}
              className={`p-6 rounded-lg border transition-colors flex flex-col items-center text-center ${
                selectedOption === 'replicated'
                  ? 'border-primary bg-primary/5'
                  : theme === 'dark'
                    ? 'border-dark-border hover:border-primary/50 bg-dark/40'
                    : 'border-gray-200 hover:border-primary/50 bg-gray-50'
              }`}
            >
              <FileQuestion className={`w-8 h-8 mb-4 ${
                selectedOption === 'replicated' ? 'text-primary' : 'text-gray-400'
              }`} />
              <h3 className={`font-medium mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                From Replicated
              </h3>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Select from your Replicated charts
              </p>
            </button>
          </div>

          {/* Prompt Input */}
          {selectedOption === 'prompt' && (
            <div className="mt-6">
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Describe Your Application
              </label>
              <div className="relative">
                <textarea
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="Example: I need a Helm chart for a web application with Redis cache and PostgreSQL database&hellip;"
                  className={`w-full px-4 py-3 rounded-lg border resize-none h-32 ${
                    theme === 'dark'
                      ? 'bg-dark border-dark-border text-gray-300 placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
                />
                <button
                  onClick={handlePromptSubmit}
                  disabled={!promptInput.trim()}
                  className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${
                    promptInput.trim()
                      ? 'text-primary hover:bg-primary/10'
                      : theme === 'dark'
                        ? 'text-gray-600'
                        : 'text-gray-400'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className={`mt-2 text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Provide details about your application&apos;s architecture and requirements
              </p>
            </div>
          )}

          {/* Replicated Options */}
          {selectedOption === 'replicated' && (
            <div className="mt-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Select Application
                </label>
                <select
                  value={selectedApp}
                  onChange={(e) => setSelectedApp(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg appearance-none border ${
                    theme === 'dark'
                      ? 'bg-dark border-dark-border text-gray-300'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Select an application...</option>
                  {apps.map((app) => (
                    <option key={app} value={app}>{app}</option>
                  ))}
                </select>
              </div>

              {selectedApp && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Select Chart
                  </label>
                  <select
                    value={selectedChart}
                    onChange={(e) => setSelectedChart(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg appearance-none border ${
                      theme === 'dark'
                        ? 'bg-dark border-dark-border text-gray-300'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">Select a chart...</option>
                    {charts.map((chart) => (
                      <option key={chart} value={chart}>{chart}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`flex justify-end gap-2 p-4 border-t ${
          theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
        }`}>
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
            className={`px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors ${
              !selectedOption ||
              (selectedOption === 'prompt' && !promptInput.trim()) ||
              (selectedOption === 'replicated' && (!selectedApp || !selectedChart))
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            disabled={
              !selectedOption ||
              (selectedOption === 'prompt' && !promptInput.trim()) ||
              (selectedOption === 'replicated' && (!selectedApp || !selectedChart))
            }
          >
            Create Chart
          </button>
        </div>
      </div>
    </div>
  );
}
