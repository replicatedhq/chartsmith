"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "@/app/hooks/useSession";
import { listUserAdminAction } from "@/lib/auth/actions/list-users";
import { updateUserAdminStatusAction } from "@/lib/auth/actions/update-admin-status";
import { UserAdmin } from "@/lib/types/user";
import { ArrowUpDown, Loader2, Shield, FolderKanban, X, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Sort directions
type SortDirection = "asc" | "desc";

// Sort fields
type SortField = "name" | "email" | "createdAt" | "lastActive" | "workspaces";


export default function UsersPage() {
  const { session } = useSession();
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [sortField, setSortField] = useState<SortField>("lastActive");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; userId: string; newStatus: boolean } | null>(null);

  // Load users and workspace counts
  useEffect(() => {
    async function loadData() {
      if (session) {
        try {
          const usersList = await listUserAdminAction(session);
          setUsers(usersList);
        } catch (error) {
          console.error("Failed to load users:", error);
        } finally {
          setLoading(false);
        }
      }
    }

    loadData();
  }, [session]);

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
  
  // Handle admin status toggle
  const handleAdminToggle = async (userId: string, newStatus: boolean) => {
    setConfirmDialog({ open: true, userId, newStatus });
  };

  // Handle confirmation of admin status change
  const handleConfirmAdminChange = async () => {
    if (!confirmDialog || !session) return;
    
    try {
      const success = await updateUserAdminStatusAction(session, confirmDialog.userId, confirmDialog.newStatus);
      if (success) {
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.id === confirmDialog.userId 
              ? { ...user, isAdmin: confirmDialog.newStatus } 
              : user
          )
        );
      }
    } catch (error) {
      console.error("Failed to update admin status:", error);
    } finally {
      setConfirmDialog(null);
    }
  };

  // Sort users
  const sortedUsers = [...users].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case "name":
        comparison = (a.name || "").localeCompare(b.name || "");
        break;
      case "email":
        comparison = a.email.localeCompare(b.email);
        break;
      case "createdAt":
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "lastActive":
        const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        comparison = aTime - bTime;
        break;
      case "workspaces":
        comparison = a.workspaceCount - b.workspaceCount;
        break;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  const formatDate = (date: Date | undefined) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-text">User Management</h2>
      </div>

      <div className="bg-surface p-6 rounded-lg border border-border">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-text py-8">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-text/70">User</th>
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
                    onClick={() => handleSort("email")}
                  >
                    <div className="flex items-center">
                      Email
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium text-text/70 cursor-pointer"
                    onClick={() => handleSort("workspaces")}
                  >
                    <div className="flex items-center">
                      Workspaces
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium text-text/70 cursor-pointer"
                    onClick={() => handleSort("createdAt")}
                  >
                    <div className="flex items-center">
                      Joined
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium text-text/70 cursor-pointer"
                    onClick={() => handleSort("lastActive")}
                  >
                    <div className="flex items-center">
                      Last Active
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text/70">Role</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-border/50 hover:bg-border/10">
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center">
                        {user.imageUrl ? (
                          <Image
                            src={user.imageUrl}
                            alt={user.name || user.email}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full mr-3"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mr-3">
                            <span className="text-primary text-xs font-medium">
                              {(user.name || user.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {user.name || "(No name)"}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link 
                        href={`/admin/workspaces?userId=${user.id}`} 
                        className="flex items-center text-primary hover:underline"
                      >
                        <FolderKanban className="w-4 h-4 mr-1.5" />
                        <span>{user.workspaceCount}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {formatDate(user.lastActiveAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={user.isAdmin || false}
                          onChange={() => handleAdminToggle(user.id, !user.isAdmin)}
                          className="mr-2 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        {user.isAdmin ? (
                          <div className="flex items-center text-primary">
                            <Shield className="w-4 h-4 mr-1" />
                            Admin
                          </div>
                        ) : (
                          "User"
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && confirmDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-lg border border-border max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Confirm Admin Status Change</h3>
              <button 
                onClick={() => setConfirmDialog(null)}
                className="text-text/50 hover:text-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mb-6">
              Are you sure you want to {confirmDialog.newStatus ? "grant" : "revoke"} admin privileges for this user?
            </p>
            <div className="flex justify-end space-x-4">
              <button 
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 border border-border rounded-md"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmAdminChange}
                className="px-4 py-2 bg-primary text-white rounded-md flex items-center"
              >
                <Check className="w-4 h-4 mr-2" /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
