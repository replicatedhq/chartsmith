"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Session } from "@/lib/types/session";
import { rollbackWorkspaceAction } from "@/lib/workspace/actions/rollback";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { logger } from "@/lib/utils/logger";

interface RollbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  revisionNumber: number;
  session: Session;
  onSuccess: (updatedWorkspace: any, updatedMessages: any[]) => void;
}

export function RollbackModal({ 
  isOpen, 
  onClose, 
  workspaceId, 
  revisionNumber, 
  session,
  onSuccess
}: RollbackModalProps) {
  const { theme } = useTheme();
  const [progress, setProgress] = useState(100);
  const [isRollbackComplete, setIsRollbackComplete] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isInitialRender, setIsInitialRender] = useState(true);

  // Reset state when modal is opened or closed
  useEffect(() => {
    if (isOpen) {
      // Set initial state immediately
      setProgress(100);
      setIsRollbackComplete(false);
      setIsCancelling(false);
      setIsInitialRender(true);
      
      // Use requestAnimationFrame to ensure DOM is updated before starting countdown
      const rafId = requestAnimationFrame(() => {
        setIsInitialRender(false);
      });
      
      return () => cancelAnimationFrame(rafId);
    } else {
      // Reset state completely when modal is closed
      setProgress(100);
    }
  }, [isOpen]);

  const handleCancel = () => {
    setIsCancelling(true);
    onClose();
  };

  const handleRollbackComplete = useCallback(async () => {
    setIsRollbackComplete(true);
    
    try {
      const updatedWorkspace = await rollbackWorkspaceAction(session, workspaceId, revisionNumber);
      const updatedMessages = await getWorkspaceMessagesAction(session, workspaceId);
      
      onSuccess(updatedWorkspace, updatedMessages);
      
      // Close the modal after successful rollback
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      logger.error("Error during rollback", { error });
    }
  }, [session, workspaceId, revisionNumber, onSuccess, onClose]);

  // Start the countdown after initial render
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isOpen && !isInitialRender && !isRollbackComplete && !isCancelling) {
      // Start at 100% and decrease to 0%
      timer = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev - 2;
          if (newProgress <= 0) {
            clearInterval(timer);
            handleRollbackComplete();
            return 0;
          }
          return newProgress;
        });
      }, 100); // 100ms intervals to reach 0% in roughly 5 seconds
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen, isInitialRender, isRollbackComplete, isCancelling, handleRollbackComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-md rounded-lg shadow-lg border ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
        <div className={`flex items-center justify-between p-4 border-b ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Rollback to Revision</h2>
          </div>
          <button 
            onClick={handleCancel} 
            className={`${theme === "dark" ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-700"} transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <p className={`${theme === "dark" ? "text-gray-300" : "text-gray-600"} mb-4`}>
            Rolling back to a previous revision. This action is irreversible and will delete all changes made after this revision.
          </p>
          
          <div className="mt-4">
            <div className="mb-1">
              <span className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                {progress > 0 ? "Rollback in progress..." : "Rollback complete!"}
              </span>
            </div>
            <div className={`h-3 rounded-full overflow-hidden ${theme === "dark" ? "bg-dark-border" : "bg-gray-200"}`}>
              <div 
                className="h-full bg-blue-500 transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className={`flex justify-end gap-2 p-4 border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
          {!isRollbackComplete && (
            <button
              onClick={handleCancel}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${theme === "dark" ? "text-gray-300 hover:text-white bg-dark-border/40 hover:bg-dark-border/60" : "text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200"}`}
            >
              Cancel Rollback
            </button>
          )}
        </div>
      </div>
    </div>
  );
}