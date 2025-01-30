"use client"

import { useEffect, useState } from "react";
import { Card } from "./ui/Card";
import { Loader2 } from "lucide-react";
import { Workspace } from "@/lib/types/workspace";
import { useSession } from "@/app/hooks/useSession";
import { createWorkspaceFromUrlAction } from "@/lib/workspace/actions/create-workspace-from-url";
import { useRouter } from "next/navigation";

export interface ImportChartProps {
  url: string;
}

export function ImportChart({ url }: ImportChartProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const router = useRouter();
  const { session } = useSession();

  useEffect(() => {
    if (!session) return;

    createWorkspaceFromUrlAction(session, url).then((w) => setWorkspace(w));
  }, [session]);

  useEffect(() => {
    if (workspace) {
      router.push(`/workspace/${workspace.id}`);
    }
  }, [workspace]);

  return (
    <div className="px-4 w-full max-w-3xl py-8 pb-16 mx-auto relative">
      <Card className="p-6 w-full border-dark-border/40 shadow-lg">
        {/* User Message */}
        <div className="px-2 py-1">
          <div className="p-3 rounded-2xl bg-primary/20 rounded-tr-sm w-full">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-[12px] pt-0.5 text-gray-200">
                  Import chart from {url}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Assistant Message */}
        <div className="px-2 py-1">
          <div className="p-3 rounded-2xl bg-dark-border/40 rounded-tl-sm w-full">
            <div className="text-xs text-gray-400 mb-1">ChartSmith</div>
            <div className="text-[12px] text-gray-200 flex items-center gap-2">
              <span>Importing chart... please wait</span>
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
