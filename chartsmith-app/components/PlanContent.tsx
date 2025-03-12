import React, { useEffect } from "react";
import { useAtom } from "jotai";

// atoms
import { messagesAtom, workspaceAtom } from "@/atoms/workspace";

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

  // We don't need to track content updates anymore since ScrollingContent handles scrolling
  
  // Scroll to bottom only when messages change
  useEffect(() => {
    // No longer needed - ScrollingContent will handle scrolling
  }, [messages]);

  if (!workspace || !messages) {
    return null;
  }

  return (
    <div className="min-h-full w-full">
      <div className="px-4 w-full max-w-3xl py-8 mx-auto h-full">
        <ScrollingContent forceScroll={true}>
          <Card className="p-6 w-full border-dark-border/40 shadow-lg">
            {messages.map((item, index) => (
              <div key={item.id}>
                <ChatMessage
                  key={item.id}
                  messageId={item.id}
                  session={session}
                  onContentUpdate={() => {
                    // No longer need to track updates - ScrollingContent will handle it
                  }}
                />
                {/* Remove duplicate plan rendering since ChatMessage already renders the plan */}
              </div>
            ))}
          </Card>
        </ScrollingContent>
      </div>
    </div>
  );
}
