"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "@/app/hooks/useSession";

import { Check, ArrowUpDown, Loader2 } from "lucide-react";
import Image from "next/image";
import { User } from "@/lib/types/user";
import { listWaitlistUsersAction } from "@/lib/auth/actions/list-waitlist-users";
import { approveWaitlistUserAction } from "@/lib/auth/actions/approve-waitlist-user";
// Sort directions
type SortDirection = "asc" | "desc";

// Sort fields
type SortField = "name" | "email" | "createdAt";

export default function WaitlistPage() {
  const { session } = useSession();
  const [waitlistUsers, setWaitlistUsers] = useState<User[]>([]);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(true);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);

  // Load waitlist users
  useEffect(() => {
    async function loadWaitlistUsers() {
      if (session) {
        try {
          const users = await listWaitlistUsersAction(session);
          setWaitlistUsers(users);
        } catch (error) {
          console.error("Failed to load waitlist users:", error);
        } finally {
          setLoading(false);
        }
      }
    }

    loadWaitlistUsers();
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

  // Sort users
  const sortedUsers = [...waitlistUsers].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "email":
        comparison = a.email.localeCompare(b.email);
        break;
      case "createdAt":
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Handle approve user
  const handleApproveUser = async (userId: string) => {
    if (!session) return;

    setApprovingUserId(userId);

    try {
      const success = await approveWaitlistUserAction(session, userId);

      if (success) {
        // Remove the approved user from the list
        setWaitlistUsers(waitlistUsers.filter(user => user.id !== userId));
      }
    } catch (error) {
      console.error("Failed to approve user:", error);
    } finally {
      setApprovingUserId(null);
    }
  };

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
        <h2 className="text-2xl font-bold text-text">Waitlist Management</h2>
      </div>

      <div className="bg-surface p-6 rounded-lg border border-border">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : waitlistUsers.length === 0 ? (
          <p className="text-center text-text py-8">No users in the waitlist.</p>
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
                    onClick={() => handleSort("createdAt")}
                  >
                    <div className="flex items-center">
                      Joined
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-text/70">Actions</th>
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
                    <td className="px-4 py-3 text-sm text-text">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <button
                        onClick={() => handleApproveUser(user.id)}
                        disabled={approvingUserId === user.id}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
                      >
                        {approvingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" />
                        )}
                        Approve
                      </button>
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