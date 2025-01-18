"use client";

import React, { useEffect, useState } from "react";
import { X, AlertTriangle, Star } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Message, Prompt } from "./editor/types";
import { getChatMessageForFeedback } from "@/lib/workspace/actions/chat-chat-message";
import { Session } from "@/lib/types/session";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message;
  chatId: string;
  workspaceId: string;
  session: Session;
}

export function FeedbackModal({ isOpen, onClose, message, chatId, workspaceId, session }: FeedbackModalProps) {
  const { theme } = useTheme();
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    if (isOpen && chatId) {
      getChatMessageForFeedback(session, workspaceId, chatId).then(setPrompt);
    }
  }, [chatId, session, workspaceId, isOpen]);

  // Handle ESC key
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      // Here you would typically send the feedback to your backend
      console.log("Feedback submitted:", {
        chatId,
        message,
        description,
        rating
      });
      onClose();
    }
  };

  // Handle click outside
  const handleClickOutside = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={handleClickOutside}>
      <div className={`w-full max-w-4xl rounded-lg shadow-lg border ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-4 border-b ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-error" />
            <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Provide Feedback</h2>
          </div>
          <button onClick={onClose} className={`${theme === "dark" ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-700"} transition-colors`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex gap-6">
            {/* Left Column */}
            <div className="flex-1 space-y-4">
              {/* Your Prompt */}
              <div>
                <h3 className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Your Prompt</h3>
                <div className={`p-4 rounded-lg ${theme === "dark" ? "bg-dark/40 text-gray-300" : "bg-gray-50 text-gray-700"}`}>
                  {message.prompt}
                </div>
              </div>

              {/* Files Sent */}
              <div>
                <h3 className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Files Sent</h3>
                <div className={`p-4 rounded-lg ${theme === "dark" ? "bg-dark/40 text-gray-300" : "bg-gray-50 text-gray-700"}`}>
                  {prompt?.filesSent ? (
                    <ul className="space-y-1">
                      {prompt.filesSent.map((path, index) => (
                        <li key={index} className="font-mono text-sm">
                          {path}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm opacity-75">No files sent</p>
                  )}
                </div>
              </div>

              {/* Response Received */}
              <div>
                <h3 className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Response Received</h3>
                <div className={`p-4 rounded-lg ${theme === "dark" ? "bg-dark/40 text-gray-300" : "bg-gray-50 text-gray-700"} h-48 overflow-y-auto`}>
                  {message.response}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex-1 space-y-6">
              {/* Rating */}
              <div>
                <h3 className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Rate this response</h3>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`p-1 rounded hover:bg-primary/10 transition-colors ${rating >= star ? "text-primary" : theme === "dark" ? "text-gray-600" : "text-gray-400"}`}
                      >
                        <Star className="w-6 h-6" fill={rating >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <span className={`text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                      {rating === 1 && "Terrible response"}
                      {rating === 2 && "Poor response"}
                      {rating === 3 && "Okay response"}
                      {rating === 4 && "Good response"}
                      {rating === 5 && "Amazing response"}
                    </span>
                  )}
                </div>
              </div>

              {/* Feedback Text */}
              <div className="flex-1">
                <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Additional Feedback</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide any additional feedback..."
                  className={`w-full px-4 py-3 rounded-lg border resize-none h-[300px] ${theme === "dark" ? "bg-dark border-dark-border text-gray-300 placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"} focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onClose} className={`px-4 py-2 text-sm rounded-lg transition-colors ${theme === "dark" ? "text-gray-300 hover:text-white bg-dark-border/40 hover:bg-dark-border/60" : "text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200"}`}>
                  Cancel
                </button>
                <button type="submit" disabled={!description.trim()} className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${description.trim() ? "bg-primary hover:bg-primary/90" : "bg-gray-500 cursor-not-allowed"}`}>
                  Submit Feedback
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
