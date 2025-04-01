"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "@/app/hooks/useSession";
import { listUserAdminAction } from "@/lib/auth/actions/list-users";
import { listWaitlistUsersAction } from "@/lib/auth/actions/list-waitlist-users";
import { approveWaitlistUserAction } from "@/lib/auth/actions/approve-waitlist-user";
import { UserAdmin, User } from "@/lib/types/user";
import { Loader2, Users, UserPlus, LayoutDashboard, Check } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { session } = useSession();
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [waitlistUsers, setWaitlistUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    async function loadData() {
      if (session) {
        try {
          const [usersList, waitlist] = await Promise.all([
            listUserAdminAction(session),
            listWaitlistUsersAction(session)
          ]);

          setUsers(usersList);
          setWaitlistUsers(waitlist);
        } catch (error) {
          console.error("Failed to load dashboard data:", error);
        } finally {
          setLoading(false);
        }
      }
    }

    loadData();
  }, [session]);

  // Handle approve user
  const handleApproveUser = async (userId: string) => {
    if (!session) return;

    setApprovingUserId(userId);

    try {
      const success = await approveWaitlistUserAction(session, userId);

      if (success) {
        // Remove the user from waitlist
        setWaitlistUsers(prevUsers => prevUsers.filter(user => user.id !== userId));

        // Refresh user list to include the newly approved user
        const updatedUsers = await listUserAdminAction(session);
        setUsers(updatedUsers);
      }
    } catch (error) {
      console.error("Failed to approve user:", error);
    } finally {
      setApprovingUserId(null);
    }
  };

  // Get active users (active in the last 7 days)
  const getActiveUsers = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return users.filter(user =>
      user.lastActiveAt && new Date(user.lastActiveAt) > sevenDaysAgo
    ).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-text">Dashboard</h2>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Users Card */}
            <div className="bg-surface p-6 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text/70">Total Users</p>
                  <h3 className="text-3xl font-bold text-text mt-1">{users.length}</h3>
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="mt-4">
                <Link
                  href="/admin/users"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  View all users
                </Link>
              </div>
            </div>

            {/* Active Users Card */}
            <div className="bg-surface p-6 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text/70">Active Users (7d)</p>
                  <h3 className="text-3xl font-bold text-text mt-1">{getActiveUsers()}</h3>
                </div>
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20">
                  <LayoutDashboard className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-text/70">
                  {Math.round((getActiveUsers() / Math.max(users.length, 1)) * 100)}% of total users
                </p>
              </div>
            </div>

            {/* Waitlist Card */}
            <div className="bg-surface p-6 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text/70">Waitlist</p>
                  <h3 className="text-3xl font-bold text-text mt-1">{waitlistUsers.length}</h3>
                </div>
                <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/20">
                  <UserPlus className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <div className="mt-4">
                <Link
                  href="/admin/waitlist"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Manage waitlist
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Waitlist Activity */}
          <div className="bg-surface p-6 rounded-lg border border-border">
            <h3 className="text-lg font-semibold mb-4">Recently Waitlisted Users</h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-sm font-medium text-text/70">Name</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-text/70">Email</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-text/70">Joined Waitlist</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-text/70">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlistUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-text/70">
                        No users currently in waitlist
                      </td>
                    </tr>
                  ) : (
                    waitlistUsers
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 5)
                      .map(user => (
                        <tr key={user.id} className="border-b border-border/50 hover:bg-border/10">
                          <td className="px-4 py-3 text-sm text-text">{user.name || "(No name)"}</td>
                          <td className="px-4 py-3 text-sm text-text">{user.email}</td>
                          <td className="px-4 py-3 text-sm text-text">
                            {new Date(user.createdAt).toLocaleDateString("en-US", {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm text-text">
                            <button
                              onClick={() => handleApproveUser(user.id)}
                              disabled={approvingUserId === user.id}
                              className="inline-flex items-center text-primary hover:text-primary/80 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {approvingUserId === user.id ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3 mr-1" />
                              )}
                              Approve
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}