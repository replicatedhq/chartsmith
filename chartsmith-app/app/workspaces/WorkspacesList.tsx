"use client";

import React, { useState } from "react";

type SortField = 'name' | 'createdAt' | 'lastUpdatedAt';
type SortDirection = 'asc' | 'desc';

import { useTheme } from "@/contexts/ThemeContext";
import { ArrowUpDown, Trash2, ArrowLeft, FolderOpen, Plus, Clock, Calendar, ChevronRight } from "lucide-react";
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

  const formatRelativeDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(date);
  };

  const SortButton = ({
    field,
    children
  }: {
    field: SortField;
    children: React.ReactNode
  }) => (
    <button
      onClick={() => handleSort(field)}
      className={`
        flex items-center gap-2 font-display font-semibold text-overline uppercase tracking-wider
        transition-colors duration-150
        ${sortField === field
          ? 'text-forge-ember'
          : theme === "dark"
            ? "text-forge-silver hover:text-stone-200"
            : "text-stone-500 hover:text-stone-700"
        }
      `}
    >
      {children}
      <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === field ? 'text-forge-ember' : 'opacity-50'}`} />
    </button>
  );

  return (
    <div className={`
      min-h-screen
      ${theme === "dark" ? "bg-forge-black" : "bg-stone-50"}
    `}>
      {/* Background pattern */}
      <div className={`
        fixed inset-0 pattern-dots pointer-events-none
        ${theme === "dark" ? "opacity-30" : "opacity-20"}
      `} />

      <div className="relative z-10 max-w-6xl mx-auto py-8 px-6">
        {/* Header */}
        <div className="mb-8">
          {/* Breadcrumb */}
          <Link
            href="/"
            className={`
              inline-flex items-center gap-2 text-sm font-medium mb-6
              transition-colors duration-150 group
              ${theme === "dark"
                ? "text-forge-silver hover:text-forge-ember"
                : "text-stone-500 hover:text-forge-ember"
              }
            `}
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Home
          </Link>

          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`
                p-3 rounded-forge-lg
                ${theme === "dark"
                  ? "bg-forge-iron/50 border border-forge-zinc"
                  : "bg-stone-100 border border-stone-200"
                }
              `}>
                <FolderOpen className="w-6 h-6 text-forge-ember" />
              </div>
              <div>
                <h1 className={`
                  font-display text-display-sm font-bold tracking-tight
                  ${theme === "dark" ? "text-stone-100" : "text-stone-900"}
                `}>
                  My Workspaces
                </h1>
                <p className={`
                  text-sm mt-0.5
                  ${theme === "dark" ? "text-forge-silver" : "text-stone-500"}
                `}>
                  {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}
                </p>
              </div>
            </div>

            <Link
              href="/workspace/new"
              className="btn-forge"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </Link>
          </div>
        </div>

        {/* Empty state */}
        {workspaces.length === 0 ? (
          <div className={`
            rounded-forge-lg border-2 border-dashed p-12 text-center
            ${theme === "dark"
              ? "border-forge-iron bg-forge-charcoal/50"
              : "border-stone-300 bg-white"
            }
          `}>
            <div className={`
              w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center
              ${theme === "dark" ? "bg-forge-iron" : "bg-stone-100"}
            `}>
              <FolderOpen className={`
                w-8 h-8
                ${theme === "dark" ? "text-forge-zinc" : "text-stone-400"}
              `} />
            </div>
            <h3 className={`
              font-display text-lg font-semibold mb-2
              ${theme === "dark" ? "text-stone-200" : "text-stone-700"}
            `}>
              No workspaces yet
            </h3>
            <p className={`
              text-sm mb-6
              ${theme === "dark" ? "text-forge-silver" : "text-stone-500"}
            `}>
              Start forging your first Helm chart
            </p>
            <Link href="/workspace/new" className="btn-forge inline-flex">
              <Plus className="w-4 h-4" />
              Create Workspace
            </Link>
          </div>
        ) : (
          /* Table */
          <div className={`
            rounded-forge-lg overflow-hidden
            ${theme === "dark"
              ? "bg-forge-charcoal border border-forge-iron"
              : "bg-white border border-stone-200 shadow-sm"
            }
          `}>
            <table className="w-full">
              <thead>
                <tr className={`
                  border-b
                  ${theme === "dark"
                    ? "border-forge-iron bg-forge-steel/50"
                    : "border-stone-200 bg-stone-50"
                  }
                `}>
                  <th className="px-6 py-4 text-left">
                    <SortButton field="name">Name</SortButton>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <SortButton field="createdAt">Created</SortButton>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <SortButton field="lastUpdatedAt">Last Modified</SortButton>
                  </th>
                  <th className="px-6 py-4 w-20">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedWorkspaces.map((workspace, index) => (
                  <tr
                    key={workspace.id}
                    className={`
                      group transition-colors duration-150
                      ${index !== sortedWorkspaces.length - 1 ? 'border-b' : ''}
                      ${theme === "dark"
                        ? "border-forge-iron/50 hover:bg-forge-iron/30"
                        : "border-stone-100 hover:bg-stone-50"
                      }
                    `}
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/workspace/${workspace.id}`}
                        className="flex items-center gap-3 group/link"
                      >
                        <div className={`
                          p-2 rounded-forge transition-colors duration-150
                          ${theme === "dark"
                            ? "bg-forge-iron/50 group-hover/link:bg-forge-ember/20"
                            : "bg-stone-100 group-hover/link:bg-forge-ember/10"
                          }
                        `}>
                          <FolderOpen className={`
                            w-4 h-4 transition-colors duration-150
                            ${theme === "dark"
                              ? "text-forge-silver group-hover/link:text-forge-ember"
                              : "text-stone-400 group-hover/link:text-forge-ember"
                            }
                          `} />
                        </div>
                        <span className={`
                          font-medium transition-colors duration-150
                          ${theme === "dark"
                            ? "text-stone-100 group-hover/link:text-forge-ember"
                            : "text-stone-900 group-hover/link:text-forge-ember"
                          }
                        `}>
                          {workspace.name}
                        </span>
                        <ChevronRight className={`
                          w-4 h-4 opacity-0 -translate-x-2 transition-all duration-150
                          group-hover/link:opacity-100 group-hover/link:translate-x-0
                          text-forge-ember
                        `} />
                      </Link>
                    </td>
                    <td
                      className={`px-6 py-4 text-sm ${theme === "dark" ? "text-forge-silver" : "text-stone-500"}`}
                      suppressHydrationWarning
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 opacity-50" />
                        {formatDate(workspace.createdAt)}
                      </div>
                    </td>
                    <td
                      className={`px-6 py-4 text-sm ${theme === "dark" ? "text-forge-silver" : "text-stone-500"}`}
                      suppressHydrationWarning
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 opacity-50" />
                        {formatRelativeDate(workspace.lastUpdatedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, workspace })}
                        className={`
                          p-2 rounded-forge opacity-0 group-hover:opacity-100
                          transition-all duration-150
                          ${theme === "dark"
                            ? "text-forge-zinc hover:text-forge-error hover:bg-forge-error/10"
                            : "text-stone-400 hover:text-red-600 hover:bg-red-50"
                          }
                        `}
                        title="Delete workspace"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sr-only">Delete workspace</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        {workspaces.length > 0 && (
          <div className={`
            mt-4 text-center text-xs
            ${theme === "dark" ? "text-forge-zinc" : "text-stone-400"}
          `}>
            Click a workspace to open it in the editor
          </div>
        )}
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
