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
  plan: Plan;
  workspace: Workspace;
  messages: Message[];
}

export function PlanContent({ session, plan, workspace, messages }: PlanContentProps) {
  if (!plan || !messages) {
    if (!plan) {
      return <div>No plan found</div>;
    }
    if (!messages) {
      return <div>No messages found</div>;
    }
    return null;
  }

  // find the chat messages for the id, based on the array in the plan
  let chatMessages: Message[] = [];
  if (plan.chatMessageIds) {
    chatMessages = messages.filter(message => plan.chatMessageIds.includes(message.id));
  }

  return (
    <div className="h-full w-full overflow-auto transition-all duration-300 ease-in-out">
      <div className="px-4 w-full max-w-3xl py-8 pb-16 mx-auto">
        <ScrollingContent>
          <Card className="p-6 w-full border-dark-border/40 shadow-lg">
            <div className="space-y-4">
              {chatMessages.map(message => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  session={session}
                  workspaceId={workspace.id}
                  showActions={false}
                  setMessages={() => {}}
                />
              ))}
              <PlanChatMessage
                plan={plan}
                showActions={true}
                session={session}
                workspaceId={workspace.id}
              />
            </div>
          </Card>
        </ScrollingContent>
      </div>
    </div>
  )
}
