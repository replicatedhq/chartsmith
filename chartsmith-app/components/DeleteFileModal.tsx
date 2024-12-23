"use client"

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface DeleteFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  isRequired?: boolean;
}

export function DeleteFileModal({ isOpen, onClose, filePath, isRequired }: DeleteFileModalProps) {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-md rounded-lg shadow-lg border ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark'
            ? 'border-dark-border'
            : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={isRequired ? "w-5 h-5 text-error" : "w-5 h-5 text-yellow-500"} />
            <h2 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {isRequired ? 'Required File' : 'Delete File'}
            </h2>
          </div>
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
          {isRequired ? (
            <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
              The file <span className="font-mono">{filePath}</span> is required and cannot be deleted.
              This file is essential for the proper functioning of your Helm chart.
            </p>
          ) : (
            <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
              Are you sure you want to delete <span className="font-mono">{filePath}</span>?
              This action cannot be undone.
            </p>
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
            {isRequired ? 'Close' : 'Cancel'}
          </button>
          {!isRequired && (
            <button
              onClick={() => {
                // Handle delete
                onClose();
              }}
              className="px-4 py-2 text-sm text-white bg-error hover:bg-error/90 rounded-lg transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
