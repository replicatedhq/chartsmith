import React, { useRef, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { useTheme } from "../../../contexts/ThemeContext";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { Plan, Workspace } from "@/lib/types/workspace";
import { PlanChatMessage } from "./PlanChatMessage";
import { ChatMessage } from "./ChatMessage";
import { Card } from "@/components/ui/Card";

interface ChatContainerProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onApplyChanges: (message: Message) => void;
  session: Session;
  workspaceId: string;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  workspace?: Workspace;
  setWorkspace?: React.Dispatch<React.SetStateAction<Workspace>>;
}

function createMessagePlanMap(currentPlans: Plan[], messages: Message[]): Map<Message[], Plan> {
  const userMessagePlanMap = new Map<Message[], Plan>();
  const seenMessageIds = new Set<string>();

  // Process plans in reverse order first to identify the newest messages for each plan
  const plansInReverseOrder = [...currentPlans].reverse();

  // Create a map of message ID to Message object for quick lookup
  const messageMap = new Map(messages.map(message => [message.id, message]));

  for (const plan of plansInReverseOrder) {
    // Get the new message IDs that haven't been seen in more recent plans
    const newMessageIds = plan.chatMessageIds.filter(id => !seenMessageIds.has(id));

    // Convert IDs to actual Message objects
    const planMessages = newMessageIds
      .map(id => messageMap.get(id))
      .filter((message): message is Message => message !== undefined);

    // Add these message IDs to seen set
    newMessageIds.forEach(id => seenMessageIds.add(id));

    // Only add to map if we found new messages
    if (planMessages.length > 0) {
      userMessagePlanMap.set(planMessages, plan);
    }
  }

  // Return a new map with entries in chronological order
  return new Map([...userMessagePlanMap.entries()].reverse());
}

export function ChatContainer({ messages, onSendMessage, onApplyChanges, session, workspaceId, setMessages, workspace, setWorkspace }: ChatContainerProps) {
  const { theme } = useTheme();
  const [chatInput, setChatInput] = useState("");

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    onSendMessage(chatInput.trim());
    setChatInput("");
  };

  const handlePlanUpdated = (plan: Plan) => {
    if (!workspace || !setWorkspace) return;
    
    setWorkspace(currentWorkspace => {
      const updatedCurrentPlans = currentWorkspace.currentPlans.map(existingPlan =>
        existingPlan.id === plan.id ? plan : existingPlan
      );
      return {
        ...currentWorkspace,
        currentPlans: updatedCurrentPlans
      };
    });
  };

  // Reference for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  let content;
  if (workspace?.currentPlans) {
    const userMessagePlanMap = createMessagePlanMap(workspace.currentPlans, messages);
    // Create reversed map for rendering
    const reversedMap = new Map([...userMessagePlanMap].reverse());

    // Find messages that aren't associated with any plan yet (like optimistic messages)
    const unassociatedMessages = messages.filter(message =>
      !workspace.currentPlans.some(plan => plan.chatMessageIds.includes(message.id))
    );

    content = (
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scroll-smooth">
        {Array.from(reversedMap).map(([userMessages, plan], index) => (
          <div key={plan.id}>
            {userMessages.map(message => (
              <ChatMessage
                key={message.id}
                message={message}
                session={session}
                workspaceId={workspaceId}
                setWorkspace={setWorkspace}
              />
            ))}
            <PlanChatMessage
              plan={plan}
              session={session}
              workspaceId={workspaceId}
              messageId={userMessages[0]?.id}
              showActions={index === reversedMap.size - 1}
              handlePlanUpdated={handlePlanUpdated}
              setMessages={setMessages}
              setWorkspace={setWorkspace}
            />
          </div>
        ))}
        {unassociatedMessages.map(message => (
          <ChatMessage
            key={message.id}
            message={message}
            session={session}
            workspaceId={workspaceId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    );
  } else {
    content = (
      <ChatPanel 
        messages={messages} 
        onSendMessage={onSendMessage} 
        onApplyChanges={onApplyChanges}
        session={session}
        workspaceId={workspaceId}
        setMessages={setMessages}
      />
    );
  }

  return (
    <div className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <div className="flex-1 overflow-y-auto">
        <div className="pb-16">
          {content}
          {workspace?.currentRevisionNumber && workspace?.currentRevisionNumber > 0 && workspace?.currentPlans?.some(plan => 
            ['planning', 'applying'].includes(plan.status)
          ) && (
            <div className="flex gap-2 justify-center py-4">
              {[0, 1, 2].map((i) => (
                <div 
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary/70"
                  style={{
                    animation: 'progress-color 1s ease infinite',
                    animationDelay: `${i * 0.15}s`
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <style jsx>{`
          @keyframes progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
      {workspace?.currentRevisionNumber && workspace?.currentRevisionNumber > 0 && workspace?.currentPlans?.some(plan => 
        !['planning', 'pending', 'applying'].includes(plan.status)
      ) && (
        <div className={`absolute bottom-0 left-0 right-0 ${theme === "dark" ? "bg-dark-surface" : "bg-white"} border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
          <form onSubmit={handleSubmitChat} className="p-3 relative">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitChat(e);
                }
              }}
              placeholder="Type your message..."
              rows={3}
              style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
              className={`w-full px-3 py-1.5 pr-10 text-sm rounded-md border resize-none overflow-hidden ${
                theme === "dark"
                  ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                  : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
              } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
            />
            <button
              type="submit"
              className={`absolute right-4 top-[18px] p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border/40 ${
                theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
