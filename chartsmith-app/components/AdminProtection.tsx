"use client";

import React, { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface AdminProtectionProps {
  children: ReactNode;
}

export function AdminProtection({ children }: AdminProtectionProps) {
  const { isAuthenticated, isAdmin, isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading) {
      if (!isAuthenticated) {
        // Not logged in, redirect to login
        router.replace("/login");
      } else if (!isAdmin) {
        // Logged in but not admin, redirect to home
        router.replace("/");
      }
    }
  }, [isAuthenticated, isAdmin, isAuthLoading, router]);

  // Don't render anything during authentication check or if not admin
  if (isAuthLoading || !isAuthenticated || !isAdmin) {
    return null;
  }

  // User is authenticated and is an admin, render children
  return <>{children}</>;
}