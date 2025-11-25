import React, { useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface DeleteWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  workspaceName: string;
}

export function DeleteWorkspaceModal({ isOpen, onClose, onConfirm, workspaceName }: DeleteWorkspaceModalProps) {
  const { theme } = useTheme();

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-forge-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div
        ref={modalRef}
        className={`
          w-full max-w-md rounded-forge-lg shadow-2xl border overflow-hidden
          ${theme === 'dark'
            ? 'bg-forge-charcoal border-forge-iron'
            : 'bg-white border-stone-200'
          }
        `}
      >
        {/* Header */}
        <div className={`
          flex items-center justify-between p-4 border-b
          ${theme === 'dark' ? 'border-forge-iron bg-red-500/5' : 'border-stone-200 bg-red-50'}
        `}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-forge flex items-center justify-center bg-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <h2 className={`
              text-lg font-display font-semibold
              ${theme === 'dark' ? 'text-stone-100' : 'text-stone-900'}
            `}>
              Delete Workspace
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`
              p-2 rounded-forge transition-all
              ${theme === 'dark'
                ? 'text-forge-zinc hover:text-stone-100 hover:bg-forge-iron/50'
                : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
              }
            `}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className={`mb-6 ${theme === 'dark' ? 'text-forge-silver' : 'text-stone-600'}`}>
            Are you sure you want to delete the workspace{' '}
            <span className="font-semibold text-red-400">&ldquo;{workspaceName}&rdquo;</span>?
            This action cannot be undone.
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className={`
                px-4 py-2.5 text-sm font-medium rounded-forge transition-all
                ${theme === 'dark'
                  ? 'text-forge-silver hover:text-stone-100 bg-forge-iron/50 hover:bg-forge-iron'
                  : 'text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200'
                }
              `}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm()}
              className="
                px-4 py-2.5 text-sm font-medium text-white
                bg-red-500 hover:bg-red-600
                rounded-forge transition-all
                focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
              "
            >
              Delete Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
