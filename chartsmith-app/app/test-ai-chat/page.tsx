"use client";

import React, { useState, useEffect, useRef } from "react";
import { Upload, Search, ArrowRight, Loader2, AlertCircle, Send } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { Footer } from "@/components/Footer";
import { HomeHeader } from "@/components/HomeHeader";
import { AuthButtons } from "@/components/AuthButtons";
import { ArtifactHubSearchModal } from "@/components/ArtifactHubSearchModal";
import { ScrollingContent } from "@/components/ScrollingContent";
import { EditorLayout } from "@/components/layout/EditorLayout";
import { useTheme } from "@/contexts/ThemeContext";
import { useSession } from "@/app/hooks/useSession";
import ReactMarkdown from "react-markdown";
import Image from "next/image";
import { 
  getDefaultProvider, 
  getDefaultModelForProvider,
  STREAMING_THROTTLE_MS,
} from "@/lib/ai";

const MAX_CHARS = 512;
const WARNING_THRESHOLD = 500;

/**
 * Test page for the new AI SDK chat component.
 * 
 * Uses the EXACT same UI as the main app's workspace flow,
 * but routes to the AI SDK backend instead of the Go backend.
 */
export default function TestAIChatPage() {
  const { theme } = useTheme();
  const { session } = useSession();
  const [prompt, setPrompt] = useState("");
  const [isApproachingLimit, setIsApproachingLimit] = useState(false);
  const [showArtifactHubSearch, setShowArtifactHubSearch] = useState(false);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'helm' | 'k8s' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const hasAutoSent = useRef(false);

  // AI SDK chat setup
  const selectedProvider = getDefaultProvider();
  const selectedModel = getDefaultModelForProvider(selectedProvider);

  const transport = React.useMemo(() => {
    return new TextStreamChatTransport({
      api: "/api/chat",
      body: {
        provider: selectedProvider,
        model: selectedModel,
      },
    });
  }, [selectedProvider, selectedModel]);

  const {
    messages,
    sendMessage,
    status,
    input: chatInput,
    setInput: setChatInput,
  } = useChat({
    transport,
    experimental_throttle: STREAMING_THROTTLE_MS,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Focus textarea on mount (landing view)
  useEffect(() => {
    if (!hasStartedChat) {
      textareaRef.current?.focus();
    }
  }, [hasStartedChat]);

  // Auto-focus chat input when entering chat view
  useEffect(() => {
    if (hasStartedChat && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [hasStartedChat]);

  // Check if approaching character limit
  useEffect(() => {
    setIsApproachingLimit(prompt.length >= WARNING_THRESHOLD);
  }, [prompt]);

  // Auto-send initial prompt when entering chat
  useEffect(() => {
    if (hasStartedChat && prompt.trim() && !hasAutoSent.current && messages.length === 0) {
      hasAutoSent.current = true;
      sendMessage({ text: prompt.trim() });
    }
  }, [hasStartedChat, prompt, messages.length, sendMessage]);

  // Handle prompt submission from landing page
  const handlePromptSubmit = async () => {
    if (prompt.trim()) {
      setHasStartedChat(true);
    }
  };

  // Handle Enter key on landing page
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePromptSubmit();
    }
  };

  // Handle chat input submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && !isLoading) {
      await sendMessage({ text: chatInput.trim() });
      setChatInput("");
    }
  };

  // Handle chat input Enter key
  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit(e);
    }
  };

  // Handle file upload (placeholder)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setPrompt(`I want to work with an uploaded ${uploadType === 'k8s' ? 'Kubernetes manifest' : 'Helm chart'}: ${file.name}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    setHasStartedChat(true);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadType(null);
  };

  const triggerFileUpload = (type: 'helm' | 'k8s') => {
    if (!isUploading) {
      setUploadType(type);
      fileInputRef.current?.click();
    }
  };

  // Get user avatar URL
  const userImageUrl = session?.user?.imageUrl || "";
  const userName = session?.user?.name || "User";

  // ========== CHAT VIEW (uses EditorLayout like main app) ==========
  if (hasStartedChat) {
    return (
      <EditorLayout>
        <div className="flex w-full overflow-hidden relative">
          {/* Chat container - full width centered (matches WorkspaceContent when no files) */}
          <div className="chat-container-wrapper transition-all duration-300 ease-in-out absolute inset-0 flex justify-center">
            <div className="w-full max-w-3xl px-4">
              <div className="flex-1 overflow-y-auto">
                {/* Matches NewChartContent layout exactly */}
                <div className={`h-[calc(100vh-3.5rem)] flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${
                  theme === "dark" ? "border-dark-border" : "border-gray-200"
                }`}>
                  <div className="flex-1 h-full">
                    <h1 className="text-2xl font-bold p-4">Create a new Helm chart</h1>
                    <ScrollingContent forceScroll={true}>
                      <div className="pb-48">
                        {messages.map((message) => (
                          <div key={message.id} className="space-y-2" data-testid="chat-message">
                            {message.role === "user" ? (
                              // User Message - matches ChatMessage.tsx exactly
                              <div className="px-2 py-1" data-testid="user-message">
                                <div className={`p-3 rounded-lg ${
                                  theme === "dark" ? "bg-primary/20" : "bg-primary/10"
                                } rounded-tr-sm w-full`}>
                                  <div className="flex items-start gap-2">
                                    {userImageUrl ? (
                                      <Image
                                        src={userImageUrl}
                                        alt={userName}
                                        width={24}
                                        height={24}
                                        className="w-6 h-6 rounded-full flex-shrink-0"
                                      />
                                    ) : (
                                      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${
                                        theme === "dark" ? "bg-primary/40 text-white" : "bg-primary/30 text-gray-700"
                                      }`}>
                                        {userName.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div className="flex-1">
                                      <div className={`${
                                        theme === "dark" ? "text-gray-200" : "text-gray-700"
                                      } text-[12px] pt-0.5`}>
                                        {message.parts?.map((part, i) => 
                                          part.type === 'text' ? <span key={i}>{part.text}</span> : null
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // Assistant Message - matches ChatMessage.tsx exactly
                              <div className="px-2 py-1" data-testid="assistant-message">
                                <div className={`p-3 rounded-lg ${
                                  theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"
                                } rounded-tl-sm w-full`}>
                                  <div className={`text-xs ${
                                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                                  } mb-1 flex items-center justify-between`}>
                                    <div>ChartSmith</div>
                                    <div className="text-[10px] opacity-70">Rev #0</div>
                                  </div>
                                  <div className={`${
                                    theme === "dark" ? "text-gray-200" : "text-gray-700"
                                  } text-[12px] markdown-content`}>
                                    {message.parts?.map((part, i) => {
                                      if (part.type === 'text') {
                                        return (
                                          <div key={i} className="prose prose-sm dark:prose-invert max-w-none">
                                            <ReactMarkdown>{part.text || ""}</ReactMarkdown>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })}
                                    {/* Show loading spinner if no parts yet */}
                                    {(!message.parts || message.parts.length === 0) && (
                                      <div className="flex items-center gap-2">
                                        <div className="flex-shrink-0 animate-spin rounded-full h-3 w-3 border border-t-transparent border-primary"></div>
                                        <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                                          generating response...
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollingContent>

                    {/* Chat input area - matches NewChartContent exactly */}
                    <div className={`absolute bottom-0 left-0 right-0 ${
                      theme === "dark"
                        ? "bg-gray-900 border-t border-gray-800"
                        : "bg-gray-50 border-t border-gray-200"
                    }`}>
                      <div className={`w-full ${
                        theme === "dark"
                          ? "bg-gray-900 border-x border-b border-gray-800"
                          : "bg-gray-50 border-x border-b border-gray-200"
                      }`}>
                        <form onSubmit={handleChatSubmit} className="p-6 relative flex gap-3 items-start max-w-5xl mx-auto">
                          <div className="flex-1 relative">
                            <textarea
                              ref={chatInputRef}
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyDown={handleChatKeyDown}
                              placeholder="Ask a question or ask for a change..."
                              rows={3}
                              disabled={isLoading}
                              style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
                              className={`w-full px-3 py-1.5 pr-10 text-sm rounded-md border resize-none overflow-hidden ${
                                theme === "dark"
                                  ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                                  : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                              } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 disabled:opacity-50`}
                            />
                            <div className="absolute right-2 top-[18px]">
                              <button
                                type="submit"
                                disabled={isLoading}
                                className={`p-1.5 rounded-full ${
                                  isLoading
                                    ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                                    : theme === "dark"
                                      ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </EditorLayout>
    );
  }

  // ========== LANDING VIEW (matches main page exactly) ==========
  return (
    <div
      className="min-h-screen bg-black text-white bg-cover bg-center bg-no-repeat flex flex-col"
      style={{
        backgroundImage: 'url("https://images.unsplash.com/photo-1667372459510-55b5e2087cd0?auto=format&fit=crop&q=80&w=2072")',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/80" />

      <div className="relative flex-1 flex flex-col">
        {/* Nav */}
        <div className="p-8 md:p-12">
          <div className="flex justify-between items-center">
            <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">
              🧪 AI SDK Test Mode
            </span>
            <AuthButtons />
          </div>
        </div>

        <main className="container mx-auto px-6 pt-12 sm:pt-20 lg:pt-32 flex-1">
          <HomeHeader />

          <div className="w-full max-w-4xl mx-auto px-4">
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-800">
              <div className="p-4 sm:p-6 relative">
                <textarea
                  ref={textareaRef}
                  placeholder="Tell me about the application you want to create a Helm chart for"
                  value={prompt}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_CHARS) {
                      setPrompt(e.target.value);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isUploading}
                  className="w-full min-h-[80px] sm:min-h-[120px] bg-transparent text-white placeholder-gray-500 text-base sm:text-lg resize-none focus:outline-none disabled:opacity-50"
                  maxLength={MAX_CHARS}
                />
                
                {isApproachingLimit && (
                  <div className="flex items-center mt-2 text-xs text-amber-500/90">
                    <AlertCircle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                    <span>ChartSmith works best with clear, concise prompts. Start simple and refine through conversation.</span>
                  </div>
                )}
                
                {prompt.trim() && (
                  <button
                    onClick={handlePromptSubmit}
                    disabled={isUploading}
                    className="absolute top-3 sm:top-4 right-3 sm:right-4 p-1.5 sm:p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-md transition-colors"
                  >
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
                {isUploading && (
                  <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4">
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2 justify-center">
              <button
                onClick={() => triggerFileUpload('helm')}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full bg-gray-800/60 backdrop-blur-sm border border-gray-700 hover:bg-gray-700/60 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:hover:bg-gray-800/60 disabled:cursor-not-allowed"
              >
                <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                Upload a Helm chart
              </button>
              <button
                onClick={() => triggerFileUpload('k8s')}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full bg-gray-800/60 backdrop-blur-sm border border-gray-700 hover:bg-gray-700/60 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:hover:bg-gray-800/60 disabled:cursor-not-allowed"
              >
                <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                Upload Kubernetes manifests
              </button>
              <button
                onClick={() => setShowArtifactHubSearch(true)}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full bg-gray-800/60 backdrop-blur-sm border border-gray-700 hover:bg-gray-700/60 transition-colors text-gray-300 hover:text-white disabled:opacity-50 disabled:hover:bg-gray-800/60 disabled:cursor-not-allowed"
              >
                <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                Start from a chart in Artifact Hub
              </button>
            </div>

            <input 
              ref={fileInputRef} 
              type="file" 
              accept=".tgz,.tar.gz,.tar" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </div>
        </main>

        <Footer />
      </div>

      <ArtifactHubSearchModal
        isOpen={showArtifactHubSearch}
        onClose={() => setShowArtifactHubSearch(false)}
      />
    </div>
  );
}
