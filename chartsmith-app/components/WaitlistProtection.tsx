"use client";

import React, { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface WaitlistProtectionProps {
  children: ReactNode;
}

export function WaitlistProtection({ children }: WaitlistProtectionProps) {
  const { isAuthenticated, isWaitlisted, isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && isWaitlisted) {
      router.replace("/waitlist");
    }
  }, [isAuthenticated, isWaitlisted, isAuthLoading, router]);

  // Don't render anything during authentication or if user is waitlisted
  if (isAuthLoading || isWaitlisted) {
    return null; // Don't render content while checking auth or if waitlisted
  }

  // User is either not authenticated or not waitlisted, so render children
  return <>{children}</>;
}