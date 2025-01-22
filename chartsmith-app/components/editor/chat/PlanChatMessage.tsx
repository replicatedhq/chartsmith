import React, { useState, useRef, useEffect } from "react";
import { Message } from "../types";
import { Session } from "@/lib/types/session";
import { useTheme } from "../../../contexts/ThemeContext";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ignorePlanAction } from "@/lib/workspace/actions/ignore-plan";

interface PlanChatMessageProps {
  showActions?: boolean;
  description: string;
}

export function PlanChatMessage({ description, showActions = true }: PlanChatMessageProps) {
  const { theme } = useTheme();

  return (
    <div className="space-y-2">
      <div className="px-4 py-2 mr-12">
        <div className={`p-4 rounded-2xl ${theme === "dark" ? "bg-dark-border/40" : "bg-gray-100"} rounded-tl-sm`}>
          <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"} mb-1`}>ChartSmith</div>
          <div className={`${theme === "dark" ? "text-gray-200" : "text-gray-700"} text-sm whitespace-pre-wrap`}>
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}
