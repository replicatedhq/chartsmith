"use client";

import React, { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PublishModal({ isOpen, onClose }: PublishModalProps) {
  const [selectedApp, setSelectedApp] = useState("");
  const [shouldPromote, setShouldPromote] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState("");
  const { theme } = useTheme();

  if (!isOpen) return null;

  const apps = ["SlackerNews", "Other App"];
  const channels = ["Unstable", "Beta", "Stable"];

  return (
    <div className="fixed inset-0 bg-forge-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className={`w-full max-w-md rounded-forge-lg shadow-2xl border overflow-hidden ${theme === "dark" ? "bg-forge-charcoal border-forge-iron" : "bg-white border-stone-200"}`}>
        <div className={`flex items-center justify-between p-4 border-b ${theme === "dark" ? "border-forge-iron bg-forge-ember/5" : "border-stone-200 bg-orange-50"}`}>
          <h2 className={`text-lg font-display font-semibold ${theme === "dark" ? "text-stone-100" : "text-stone-900"}`}>Publish to Replicated</h2>
          <button onClick={onClose} className={`p-2 rounded-forge transition-all ${theme === "dark" ? "text-forge-zinc hover:text-stone-100 hover:bg-forge-iron/50" : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className={theme === "dark" ? "text-forge-silver" : "text-stone-600"}>This will create a new release of your Helm chart in the Replicated platform.</p>

          <div className="space-y-2">
            <label className={`block text-sm font-medium ${theme === "dark" ? "text-forge-silver" : "text-stone-700"}`}>Select Application</label>
            <div className="relative">
              <select
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-forge appearance-none pr-8 border ${theme === "dark" ? "bg-forge-charcoal border-forge-iron text-stone-100" : "bg-white border-stone-300 text-stone-900"} focus:outline-none focus:ring-2 focus:ring-forge-ember/50 focus:border-forge-ember/50`}
              >
                <option value="">Select an application...</option>
                {apps.map((app) => (
                  <option key={app} value={app}>
                    {app}
                  </option>
                ))}
              </select>
              <ChevronDown className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${theme === "dark" ? "text-forge-zinc" : "text-stone-500"}`} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={shouldPromote} onChange={(e) => setShouldPromote(e.target.checked)} className={`rounded-sm border-2 ${theme === "dark" ? "bg-forge-charcoal border-forge-iron text-forge-ember focus:ring-forge-ember" : "bg-white border-stone-300 text-forge-ember focus:ring-forge-ember"}`} />
              <span className={`text-sm ${theme === "dark" ? "text-forge-silver" : "text-stone-700"}`}>Promote to channel</span>
            </label>

            {shouldPromote && (
              <div className="relative mt-2">
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-forge appearance-none pr-8 border ${theme === "dark" ? "bg-forge-charcoal border-forge-iron text-stone-100" : "bg-white border-stone-300 text-stone-900"} focus:outline-none focus:ring-2 focus:ring-forge-ember/50 focus:border-forge-ember/50`}
                >
                  <option value="">Select a channel...</option>
                  {channels.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${theme === "dark" ? "text-forge-zinc" : "text-stone-500"}`} />
              </div>
            )}
          </div>
        </div>
        <div className={`flex justify-end gap-3 p-4 border-t ${theme === "dark" ? "border-forge-iron" : "border-stone-200"}`}>
          <button onClick={onClose} className={`px-4 py-2.5 text-sm font-medium rounded-forge transition-all ${theme === "dark" ? "text-forge-silver hover:text-stone-100 bg-forge-iron/50 hover:bg-forge-iron" : "text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200"}`}>
            Cancel
          </button>
          <button className={`px-4 py-2.5 text-sm font-medium text-white bg-forge-ember hover:bg-forge-ember-bright hover:shadow-ember rounded-forge transition-all ${!selectedApp || (shouldPromote && !selectedChannel) ? "opacity-50 cursor-not-allowed" : ""}`} disabled={!selectedApp || (shouldPromote && !selectedChannel)}>
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
