"use client";

import React from "react";
import { X, AlertTriangle, FileX } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface DeleteFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  isRequired?: boolean;
  onConfirm: () => void;
}

export function DeleteFileModal({ isOpen, onClose, filePath, isRequired, onConfirm }: DeleteFileModalProps) {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-forge-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className={`
        w-full max-w-md rounded-forge-lg shadow-2xl border overflow-hidden
        ${theme === "dark"
          ? "bg-forge-charcoal border-forge-iron"
          : "bg-white border-stone-200"
        }
      `}>
        {/* Header */}
        <div className={`
          flex items-center justify-between p-4 border-b
          ${theme === "dark"
            ? `border-forge-iron ${isRequired ? 'bg-red-500/5' : 'bg-yellow-500/5'}`
            : `border-stone-200 ${isRequired ? 'bg-red-50' : 'bg-yellow-50'}`
          }
        `}>
          <div className="flex items-center gap-3">
            <div className={`
              w-8 h-8 rounded-forge flex items-center justify-center
              ${isRequired ? 'bg-red-500/20' : 'bg-yellow-500/20'}
            `}>
              {isRequired ? (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              ) : (
                <FileX className="w-4 h-4 text-yellow-400" />
              )}
            </div>
            <h2 className={`
              text-lg font-display font-semibold
              ${theme === "dark" ? "text-stone-100" : "text-stone-900"}
            `}>
              {isRequired ? "Required File" : "Delete File"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`
              p-2 rounded-forge transition-all
              ${theme === "dark"
                ? "text-forge-zinc hover:text-stone-100 hover:bg-forge-iron/50"
                : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              }
            `}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isRequired ? (
            <p className={theme === "dark" ? "text-forge-silver" : "text-stone-600"}>
              The file <span className="font-mono text-forge-ember">{filePath}</span> is required and cannot be deleted.
              This file is essential for the proper functioning of your Helm chart.
            </p>
          ) : (
            <p className={theme === "dark" ? "text-forge-silver" : "text-stone-600"}>
              Are you sure you want to delete{' '}
              <span className="font-mono text-red-400">{filePath}</span>?
              This action cannot be undone.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className={`
          flex justify-end gap-3 p-4 border-t
          ${theme === "dark" ? "border-forge-iron" : "border-stone-200"}
        `}>
          <button
            onClick={onClose}
            className={`
              px-4 py-2.5 text-sm font-medium rounded-forge transition-all
              ${theme === "dark"
                ? "text-forge-silver hover:text-stone-100 bg-forge-iron/50 hover:bg-forge-iron"
                : "text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200"
              }
            `}
          >
            {isRequired ? "Close" : "Cancel"}
          </button>
          {!isRequired && (
            <button
              onClick={onConfirm}
              className="
                px-4 py-2.5 text-sm font-medium text-white
                bg-red-500 hover:bg-red-600
                rounded-forge transition-all
              "
            >
              Delete File
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
