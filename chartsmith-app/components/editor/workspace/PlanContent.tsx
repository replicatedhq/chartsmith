"use client"

import { Card } from "@/components/ui/Card";
import { Session } from "@/lib/types/session";
import { Plan, Workspace } from "@/lib/types/workspace";
import { Message } from "../types";
import { ChatMessage } from "../chat/ChatMessage";
import { PlanChatMessage } from "../chat/PlanChatMessage";

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
        <Card className="p-6 w-full border-dark-border/40 shadow-lg">
          <div className="space-y-4">
            {plan.status}
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
          </div>
        </Card>
        <Card className="p-6 w-full border-dark-border/40 shadow-lg">
          <PlanChatMessage
            description={plan.description}
            showActions={false}
          />
        </Card>
      </div>
    </div>
  )
}
