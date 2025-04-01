"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "@/app/hooks/useSession";
import { useSearchParams } from "next/navigation";
import { listWorkspacesAction } from "@/lib/workspace/actions/list-workspaces";
import { Workspace } from "@/lib/types/workspace";
import { Loader2, ArrowUpDown, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Sort directions
type SortDirection = "asc" | "desc";

// Sort fields
type SortField = "name" | "createdAt" | "lastUpdatedAt";

export default function AdminWorkspacesPage() {
  const { session } = useSession();
  const searchParams = useSearchParams();
  const userId = searchParams?.get("userId");
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sortField, setSortField] = useState<SortField>("lastUpdatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  
  // Load workspaces for the user
  useEffect(() => {
    async function loadWorkspaces() {
      if (session && userId) {
        try {
          const data = await listWorkspacesAction(session, userId);
          setWorkspaces(data.workspaces);
          setUserName(data.userName || data.userEmail || "User");
        } catch (error) {
          console.error("Failed to load workspaces:", error);
        } finally {
          setLoading(false);
        }
      } else if (session) {
        // Load all workspaces if no userId provided
        try {
          const data = await listWorkspacesAction(session);
          setWorkspaces(data.workspaces);
        } catch (error) {
          console.error("Failed to load all workspaces:", error);
        } finally {
          setLoading(false);
        }
      }
    }
    
    loadWorkspaces();
  }, [session, userId]);
  
  // Handle sort change
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };
  
  // Sort workspaces
  const sortedWorkspaces = [...workspaces].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "createdAt":
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "lastUpdatedAt":
        comparison = new Date(a.lastUpdatedAt).getTime() - new Date(b.lastUpdatedAt).getTime();
        break;
    }
    
    return sortDirection === "asc" ? comparison : -comparison;
  });
  
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link href="/admin/users" className="mr-3 text-primary hover:text-primary/80">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-2xl font-bold text-text">
            {userId ? `Workspaces for ${userName}` : "All Workspaces"}
          </h2>
        </div>
      </div>
      
      <div className="bg-surface p-6 rounded-lg border border-border">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : workspaces.length === 0 ? (
          <p className="text-center text-text py-8">No workspaces found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th
                    className="px-4 py-3 text-left text-sm font-medium text-text/70 cursor-pointer"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Name
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium text-text/70 cursor-pointer"
                    onClick={() => handleSort("createdAt")}
                  >
                    <div className="flex items-center">
                      Created
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium text-text/70 cursor-pointer"
                    onClick={() => handleSort("lastUpdatedAt")}
                  >
                    <div className="flex items-center">
                      Last Updated
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text/70">Charts</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text/70">Files</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text/70">Revision</th>
                </tr>
              </thead>
              <tbody>
                {sortedWorkspaces.map((workspace) => (
                  <tr key={workspace.id} className="border-b border-border/50 hover:bg-border/10">
                    <td className="px-4 py-3 text-sm text-text">
                      <Link 
                        href={`/workspace/${workspace.id}`} 
                        target="_blank"
                        className="text-primary hover:underline"
                      >
                        {workspace.name || workspace.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {formatDate(workspace.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {formatDate(workspace.lastUpdatedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {workspace.charts?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {workspace.files?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {workspace.currentRevisionNumber}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}