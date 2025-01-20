"use client";

import React, { useState } from "react";

type SortField = 'name' | 'createdAt' | 'lastUpdatedAt';
type SortDirection = 'asc' | 'desc';

import { useTheme } from "@/contexts/ThemeContext";
import { Card } from "@/components/ui/Card";
import { ArrowUpDown, Trash2 } from "lucide-react";
import Link from "next/link";
import { DeleteWorkspaceModal } from "./DeleteWorkspaceModal";
import { Workspace } from "@/lib/types/workspace";
import { deleteWorkspaceAction } from "@/lib/workspace/actions/delete-workspace";
import { useSession } from "@/app/hooks/useSession";
import { logger } from "@/lib/utils/logger";

interface WorkspacesListProps {
  initialWorkspaces: Workspace[];
}

export function WorkspacesList({ initialWorkspaces }: WorkspacesListProps) {
  const { theme } = useTheme();
  const { session } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [sortField, setSortField] = useState<SortField>('lastUpdatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    workspace: Workspace | null;
  }>({
    isOpen: false,
    workspace: null,
  });

  const sortedWorkspaces = [...workspaces].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    const direction = sortDirection === 'asc' ? 1 : -1;

    if (aValue < bValue) return -1 * direction;
    if (aValue > bValue) return 1 * direction;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const DateCell = ({ date }: { date: Date }) => (
    <td
      className={`px-6 py-4 text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
      suppressHydrationWarning
    >
      {formatDate(date)}
    </td>
  );

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className={`text-2xl font-bold mb-8 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
          My Workspaces
        </h1>
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className={`text-sm ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-gray-50 border-gray-200"}`}>
              <tr>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('name')}
                    className={`flex items-center gap-2 font-medium ${theme === "dark" ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                  >
                    Name
                    <ArrowUpDown className={`w-4 h-4 ${sortField === 'name' ? 'text-primary' : ''}`} />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('createdAt')}
                    className={`flex items-center gap-2 font-medium ${theme === "dark" ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                  >
                    Created
                    <ArrowUpDown className={`w-4 h-4 ${sortField === 'createdAt' ? 'text-primary' : ''}`} />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('lastUpdatedAt')}
                    className={`flex items-center gap-2 font-medium ${theme === "dark" ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                  >
                    Last Modified
                    <ArrowUpDown className={`w-4 h-4 ${sortField === 'lastUpdatedAt' ? 'text-primary' : ''}`} />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sortedWorkspaces.map((workspace) => (
                <tr
                  key={workspace.id}
                  className={`group ${theme === "dark" ? "hover:bg-dark-border/40" : "hover:bg-gray-50"}`}
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/workspace/${workspace.id}`}
                      className={`text-primary hover:text-primary/80`}
                    >
                      {workspace.name}
                    </Link>
                  </td>
                  <DateCell date={workspace.createdAt} />
                  <DateCell date={workspace.lastUpdatedAt} />
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, workspace })}
                      className={`p-2 rounded-lg cursor-pointer ${
                        theme === "dark"
                          ? "text-gray-400 hover:bg-dark-border/60 hover:text-error"
                          : "text-gray-500 hover:bg-gray-100 hover:text-error"
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="sr-only">Delete workspace</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <DeleteWorkspaceModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, workspace: null })}
        onConfirm={async function handleDeleteConfirm() {
          if (!session || !deleteModal.workspace) {
            logger.warn('Missing session or workspace:', { session, workspace: deleteModal.workspace });
            return;
          }

          try {
            logger.info('Starting deletion of workspace:', {id: deleteModal.workspace.id});
            await deleteWorkspaceAction(session, deleteModal.workspace.id);

            // Remove the workspace from the local state
            setWorkspaces(prevWorkspaces =>
              prevWorkspaces.filter(w => w.id !== deleteModal.workspace?.id)
            );
            logger.info('Successfully deleted workspace:',{ id: deleteModal.workspace.id});
          } catch (error) {
            logger.error('Failed to delete workspace:', error);
          }

          setDeleteModal({ isOpen: false, workspace: null });
        }}
        workspaceName={deleteModal.workspace?.name || ''}
      />
    </div>
  );
}
