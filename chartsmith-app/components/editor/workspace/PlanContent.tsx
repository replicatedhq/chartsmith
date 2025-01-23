'use client';

import React from "react";
import { Card } from "@/components/ui/Card";
import { Session } from "@/lib/types/session";
import { Plan, Workspace } from "@/lib/types/workspace";
import { Message } from "../types";
import { ChatMessage } from "../chat/ChatMessage";
import { PlanChatMessage } from "../chat/PlanChatMessage";

// Separate client component for the scrolling behavior
const ScrollingContent = React.memo(function ScrollingContent({ children }: { children: React.ReactNode }) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true);

  React.useEffect(() => {
    const parent = messagesEndRef.current?.closest('.overflow-auto');
    if (!parent) return;

    const handleScroll = () => {
      const isAtBottom = parent.scrollHeight - parent.clientHeight - parent.scrollTop < 50;
      setShouldAutoScroll(isAtBottom);
    };

    parent.addEventListener('scroll', handleScroll);
    return () => parent.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    if (messagesEndRef.current && shouldAutoScroll) {
      const parent = messagesEndRef.current.closest('.overflow-auto');
      if (parent) {
        parent.scrollTop = parent.scrollHeight;
      }
    }
  });

  return (
    <>
      {children}
      <div ref={messagesEndRef} />
    </>
  );
});

interface PlanContentProps {
  session: Session;
  workspace: Workspace;
  messages: Message[];
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

export function PlanContent({ session, workspace, messages }: PlanContentProps) {
  if (!workspace || !messages) {
    if (!workspace) {
      return <div>No workspace found</div>;
    }
    if (!messages) {
      return <div>No messages found</div>;
    }
    return null;
  }

  console.log(workspace.currentPlans);

  console.log('PlanContent received workspace:', workspace);
  console.log('PlanContent received messages:', messages);
  const userMessagePlanMap = createMessagePlanMap(workspace.currentPlans, messages);
  console.log('Created userMessagePlanMap:', userMessagePlanMap);
  // Create reversed map for rendering
  const reversedMap = new Map([...userMessagePlanMap].reverse());

  return (
    <div className="h-full w-full overflow-auto transition-all duration-300 ease-in-out">
      <div className="px-4 w-full max-w-3xl py-8 pb-16 mx-auto">
        <ScrollingContent>
          <Card className="p-6 w-full border-dark-border/40 shadow-lg">
            {Array.from(reversedMap).map(([userMessages, plan], index) => (
              <div key={plan.id}>
                {userMessages.map(message => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    session={session}
                    workspaceId={workspace.id}
                  />
                ))}
                <PlanChatMessage
                  plan={plan}
                  session={session}
                  workspaceId={workspace.id}
                  messageId={userMessages[0]?.id}
                  showActions={index === reversedMap.size - 1}
                />
              </div>
            ))}
          </Card>
        </ScrollingContent>
      </div>
    </div>
  )
}
