import React from "react";
import { useAtom } from "jotai";

// atoms
import { messagesAtom, workspaceAtom, handlePlanUpdatedAtom } from "@/atoms/workspace";

// types
import { Session } from "@/lib/types/session";

// components
import { ChatMessage } from "@/components/ChatMessage";
import { PlanChatMessage } from "@/components/PlanChatMessage";
import { Card } from "@/components/ui/Card";
import { ScrollingContent } from "@/components/ScrollingContent";

interface PlanContentProps {
  session: Session;
}

export function PlanContent({ session }: PlanContentProps) {
  const [workspace] = useAtom(workspaceAtom);
  const [messages] = useAtom(messagesAtom);

  if (!workspace || !messages) {
    return null;
  }

  return (
    <div className="min-h-full w-full">
      <div className="px-4 w-full max-w-3xl py-8 mx-auto">
        <ScrollingContent>
          <Card className="p-6 w-full border-dark-border/40 shadow-lg">
            {messages.map((item, index) => (
              <div key={item.id}>
                <ChatMessage
                  key={item.id}
                  messageId={item.id}
                  session={session}
                />
                {item.responsePlanId && (
                  <PlanChatMessage
                    data-testid="plan-message"
                    planId={item.responsePlanId}
                    session={session}
                    workspaceId={workspace.id}
                    messageId={item.id}
                    showActions={index === messages.length - 1}
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
