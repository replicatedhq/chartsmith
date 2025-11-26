"use client";

import React, { useEffect, useState } from "react";
import { X, AlertTriangle, Star } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Message, Prompt } from "./types";
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
    <div className="fixed inset-0 bg-forge-black/80 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={handleClickOutside}>
      <div className={`w-full max-w-4xl rounded-forge-lg shadow-2xl border overflow-hidden ${theme === "dark" ? "bg-forge-charcoal border-forge-iron" : "bg-white border-stone-200"}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-4 border-b ${theme === "dark" ? "border-forge-iron bg-forge-ember/5" : "border-stone-200 bg-orange-50"}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-forge flex items-center justify-center bg-forge-ember/20">
              <AlertTriangle className="w-4 h-4 text-forge-ember" />
            </div>
            <h2 className={`text-lg font-display font-semibold ${theme === "dark" ? "text-stone-100" : "text-stone-900"}`}>Provide Feedback</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-forge transition-all ${theme === "dark" ? "text-forge-zinc hover:text-stone-100 hover:bg-forge-iron/50" : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex gap-6">
            {/* Left Column */}
            <div className="flex-1 space-y-4">
              {/* Your Prompt */}
              <div>
                <h3 className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-forge-silver" : "text-stone-700"}`}>Your Prompt</h3>
                <div className={`p-4 rounded-forge ${theme === "dark" ? "bg-forge-black/40 text-forge-silver border border-forge-iron/50" : "bg-stone-50 text-stone-700"}`}>
                  {message.prompt}
                </div>
              </div>

              {/* Files Sent */}
              <div>
                <h3 className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-forge-silver" : "text-stone-700"}`}>Files Sent</h3>
                <div className={`p-4 rounded-forge ${theme === "dark" ? "bg-forge-black/40 text-forge-silver border border-forge-iron/50" : "bg-stone-50 text-stone-700"}`}>
                  {prompt?.filesSent ? (
                    <ul className="space-y-1">
                      {prompt.filesSent.map((path, index) => (
                        <li key={index} className="font-mono text-sm text-forge-ember">
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
                <h3 className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-forge-silver" : "text-stone-700"}`}>Response Received</h3>
                <div className={`p-4 rounded-forge ${theme === "dark" ? "bg-forge-black/40 text-forge-silver border border-forge-iron/50" : "bg-stone-50 text-stone-700"} h-48 overflow-y-auto`}>
                  {message.response}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex-1 space-y-6">
              {/* Rating */}
              <div>
                <h3 className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-forge-silver" : "text-stone-700"}`}>Rate this response</h3>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`p-1 rounded-forge hover:bg-forge-ember/10 transition-all ${rating >= star ? "text-forge-ember" : theme === "dark" ? "text-forge-zinc" : "text-stone-400"}`}
                      >
                        <Star className="w-6 h-6" fill={rating >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <span className={`text-sm ${theme === "dark" ? "text-forge-silver" : "text-stone-700"}`}>
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
                <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-forge-silver" : "text-stone-700"}`}>Additional Feedback</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide any additional feedback..."
                  className={`w-full px-4 py-3 rounded-forge border resize-none h-[300px] ${theme === "dark" ? "bg-forge-charcoal border-forge-iron text-stone-100 placeholder-forge-zinc" : "bg-white border-stone-300 text-stone-900 placeholder-stone-400"} focus:outline-none focus:ring-2 focus:ring-forge-ember/50 focus:border-forge-ember/50`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onClose} className={`px-4 py-2.5 text-sm font-medium rounded-forge transition-all ${theme === "dark" ? "text-forge-silver hover:text-stone-100 bg-forge-iron/50 hover:bg-forge-iron" : "text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200"}`}>
                  Cancel
                </button>
                <button type="submit" disabled={!description.trim()} className={`px-4 py-2.5 text-sm font-medium text-white rounded-forge transition-all ${description.trim() ? "bg-forge-ember hover:bg-forge-ember-bright hover:shadow-ember" : "bg-forge-zinc cursor-not-allowed"}`}>
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
