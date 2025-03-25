"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "@/app/hooks/useSession";
import { listUsersAction } from "@/lib/auth/actions/list-users";
import { User } from "@/lib/types/user";
import { ArrowUpDown, Loader2, Shield } from "lucide-react";
import Image from "next/image";

// Sort directions
type SortDirection = "asc" | "desc";

// Sort fields
type SortField = "name" | "email" | "createdAt" | "lastActive";

export default function UsersPage() {
  const { session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [sortField, setSortField] = useState<SortField>("lastActive");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(true);
  
  // Load users
  useEffect(() => {
    async function loadUsers() {
      if (session) {
        try {
          const usersList = await listUsersAction(session);
          setUsers(usersList);
        } catch (error) {
          console.error("Failed to load users:", error);
        } finally {
          setLoading(false);
        }
      }
    }
    
    loadUsers();
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
                    <td className="px-4 py-3 text-sm text-text">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {formatDate(user.lastActiveAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {user.isAdmin ? (
                        <div className="flex items-center text-primary">
                          <Shield className="w-4 h-4 mr-1" />
                          Admin
                        </div>
                      ) : (
                        "User"
                      )}
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