import { useTheme } from "../contexts/ThemeContext";
import { Session } from "@/lib/types/session";
import { Send, Loader2 } from "lucide-react";
import { messagesAtom, workspaceAtom, isRenderingAtom, plansAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";
import { ScrollingContent } from "./ScrollingContent";
import { NewChartChatMessage } from "./NewChartChatMessage";
import { createRevisionAction } from "@/lib/workspace/actions/create-revision";
import { useEffect, useState } from "react";

interface NewChartContentProps {
  session: Session;
  chatInput: string;
  setChatInput: (value: string) => void;
  handleSubmitChat: (e: React.FormEvent) => void;
}

export function NewChartContent({ session, chatInput, setChatInput, handleSubmitChat }: NewChartContentProps) {
  const { theme } = useTheme();
  const [messages] = useAtom(messagesAtom);
  const [isRendering] = useAtom(isRenderingAtom);
  const [, setWorkspace] = useAtom(workspaceAtom);
  const [plans] = useAtom(plansAtom);
  const [showInput, setShowInput] = useState(() => {
    // Check the LAST plan (most recent) since new plans are added to the end of the array
    const lastPlan = plans[plans.length - 1];
    return lastPlan?.status === "review";
  });

  useEffect(() => {
    const lastPlan = plans[plans.length - 1];
    setShowInput(lastPlan?.status === "review");
  }, [plans]);

  const handleCreateChart = async () => {
    if (!session || !messages.length || !plans.length) return;

    const lastPlan = plans[plans.length - 1];
    if (!lastPlan) return;

    // Get the currently selected model from localStorage
    const selectedModelId = typeof window !== 'undefined' 
      ? localStorage.getItem('preferredModelId') || undefined 
      : undefined;

    const updatedWorkspace = await createRevisionAction(session, lastPlan.id, selectedModelId);
    if (updatedWorkspace) {
      setWorkspace(updatedWorkspace);
    }
  };

  return (
    <div className={`h-[calc(100vh-3.5rem)] flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
      <div className="flex-1 h-full">
        <h1 className="text-2xl font-bold p-4">Create a new Helm chart</h1>
        <ScrollingContent forceScroll={true}>
          <div className={showInput ? "pb-48" : "pb-4"}>
            {messages.map((item) => (
              <div key={item.id}>
                <NewChartChatMessage
                  key={item.id}
                  messageId={item.id}
                  session={session}
                />
              </div>
            ))}
          </div>
        </ScrollingContent>
        {showInput && (
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
              <form onSubmit={handleSubmitChat} className="p-6 relative flex gap-3 items-start max-w-5xl mx-auto">
                <div className="flex-1 relative">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isRendering) {
                          handleSubmitChat(e);
                        }
                      }
                    }}
                    placeholder="Ask a question or ask for a change..."
                    rows={3}
                    style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
                    className={`w-full px-3 py-1.5 pr-10 text-sm rounded-md border resize-none overflow-hidden ${
                      theme === "dark"
                        ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                        : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                    } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
                  />
                  <div className="absolute right-2 top-[18px]">
                    <button
                      type="submit"
                      disabled={isRendering}
                      className={`p-1.5 rounded-full ${
                        isRendering
                          ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                          : theme === "dark"
                            ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {isRendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isRendering || !messages.length}
                  onClick={handleCreateChart}
                  className={`px-4 py-2 rounded-md text-sm font-medium self-center whitespace-nowrap ${
                    isRendering || !messages.length
                      ? "bg-gray-300 cursor-not-allowed text-gray-500"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}
                >
                  Create Chart
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
