import React from "react";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { Workspace, Plan } from "@/lib/types/workspace";
import { ChatMessage } from "../chat/ChatMessage";
import { PlanChatMessage } from "../chat/PlanChatMessage";
import { Card } from "@/components/ui/Card";
import { ScrollingContent } from "./ScrollingContent";

interface PlanContentProps {
  session: Session;
  workspace: Workspace;
  messages: Message[];
  handlePlanUpdated: (plan: Plan) => void;
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
  setWorkspace?: React.Dispatch<React.SetStateAction<Workspace>>;
  onSendMessage: (message: string) => void;
}

export function PlanContent({ session, workspace, messages, handlePlanUpdated, setMessages, setWorkspace, onSendMessage }: PlanContentProps) {
  if (!workspace || !messages) {
    return null;
  }

  // First, sort all messages chronologically
  const sortedMessages = [...messages].sort((a, b) => {
    // Keep temp messages at bottom
    const aIsTemp = a.id.startsWith('msg-temp-');
    const bIsTemp = b.id.startsWith('msg-temp-');

    if (aIsTemp !== bIsTemp) {
      return aIsTemp ? 1 : -1;
    }

    // For non-temp messages, sort by date with oldest at top
    const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
    return aDate.getTime() - bDate.getTime(); // Oldest at top
  });

  // Create a map of message IDs to their plans
  const messagePlanMap = new Map<string, Plan>();
  workspace.currentPlans.forEach(plan => {
    plan.chatMessageIds.forEach(messageId => {
      messagePlanMap.set(messageId, plan);
    });
  });

  // Process messages in chronological order
  const renderItems: Array<{
    type: 'plan' | 'message';
    messages: Message[];
    plan?: Plan;
  }> = [];

  let currentPlanMessages: Message[] | null = null;
  let currentPlan: Plan | null = null;

  sortedMessages.forEach(message => {
    const plan = messagePlanMap.get(message.id);

    if (plan) {
      // If it's a different plan than we're currently collecting
      if (currentPlan && plan.id !== currentPlan.id) {
        // Add the previous plan's messages
        renderItems.push({
          type: 'plan',
          messages: currentPlanMessages!,
          plan: currentPlan
        });
        currentPlanMessages = [message];
        currentPlan = plan;
      }
      // If we're starting a new plan
      else if (!currentPlan) {
        currentPlanMessages = [message];
        currentPlan = plan;
      }
      // If it's the same plan, add to current messages
      else {
        currentPlanMessages!.push(message);
      }
    } else {
      // First add any pending plan
      if (currentPlan && currentPlanMessages) {
        renderItems.push({
          type: 'plan',
          messages: currentPlanMessages,
          plan: currentPlan
        });
        currentPlanMessages = null;
        currentPlan = null;
      }
      // Then add the non-plan message
      renderItems.push({
        type: 'message',
        messages: [message]
      });
    }
  });

  // Add any remaining plan at the end
  if (currentPlan && currentPlanMessages) {
    renderItems.push({
      type: 'plan',
      messages: currentPlanMessages,
      plan: currentPlan
    });
  }

  return (
    <div className="h-full w-full overflow-auto transition-all duration-300 ease-in-out">
      <div className="px-4 w-full max-w-3xl py-8 pb-16 mx-auto relative">
        <ScrollingContent>
          <Card className="p-6 w-full border-dark-border/40 shadow-lg">
            {renderItems.map((item, index) => (
              <div key={item.type === 'plan' ? item.plan!.id : item.messages[0].id}>
                {item.type === 'plan' ? (
                  <>
                    {item.messages.map(message => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        session={session}
                        workspaceId={workspace.id}
                        setWorkspace={setWorkspace}
                      />
                    ))}
                    <PlanChatMessage
                      plan={item.plan!}
                      session={session}
                      workspaceId={workspace.id}
                      messageId={item.messages[0]?.id}
                      showActions={index === renderItems.length - 1}
                      handlePlanUpdated={handlePlanUpdated}
                      setMessages={setMessages}
                      setWorkspace={setWorkspace}
                      workspace={workspace}
                      messages={messages}
                      onSendMessage={onSendMessage}
                    />
                  </>
                ) : (
                  <ChatMessage
                    key={item.messages[0].id}
                    message={item.messages[0]}
                    session={session}
                    workspaceId={workspace.id}
                    showChatInput={index === renderItems.length - 1}
                    onSendMessage={onSendMessage}
                    workspace={workspace}
                    setWorkspace={setWorkspace}
                  />
                )}
              </div>
            ))}
          </Card>
        </ScrollingContent>
      </div>
    </div>
  );
}
