"use client";

import React, { useEffect } from "react";
import { Footer } from "@/components/Footer";
import { HomeHeader } from "@/components/HomeHeader";
import { CreateChartOptions } from "@/components/CreateChartOptions";
import { HomeNav } from "@/components/HomeNav";
import { useSetAtom, useAtomValue } from 'jotai';
import { messagesAtom, plansAtom, rendersAtom, workspaceAtom, conversionsAtom } from '@/atoms/workspace';
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const workspace = useAtomValue(workspaceAtom);
  const setWorkspace = useSetAtom(workspaceAtom);
  const setMessages = useSetAtom(messagesAtom);
  const setPlans = useSetAtom(plansAtom);
  const setRenders = useSetAtom(rendersAtom);
  const setConversions = useSetAtom(conversionsAtom);
  const { isWaitlisted, isAuthLoading } = useAuth();
  const router = useRouter();

  // Handle waitlist redirect - only for initial page load, not for explicit navigation
  useEffect(() => {
    // Check if this was a direct page load rather than navigation from waitlist page
    const isDirectPageLoad = !document.referrer.includes('/waitlist');
    
    if (!isAuthLoading && isWaitlisted && isDirectPageLoad) {
      router.replace('/waitlist');
    }
  }, [isWaitlisted, isAuthLoading, router]);

  useEffect(() => {
    if (workspace !== null) {
      setWorkspace(null);
      setMessages([]);
      setPlans([]);
      setRenders([]);
      setConversions([]);
    }
  }, [workspace, setWorkspace, setMessages, setPlans, setRenders, setConversions]);

  // Show loading state or nothing while authentication is being checked
  if (isAuthLoading || isWaitlisted) {
    return null; // Don't render anything while loading or if waitlisted (will redirect)
  }

  return (
    <div
      className="min-h-screen bg-black text-white bg-cover bg-center bg-no-repeat flex flex-col"
      style={{
        backgroundImage: 'url("https://images.unsplash.com/photo-1667372459510-55b5e2087cd0?auto=format&fit=crop&q=80&w=2072")',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/80" />

      <div className="relative flex-1 flex flex-col">
        <HomeNav />
        <main className="container mx-auto px-6 pt-12 sm:pt-20 lg:pt-32 flex-1">
          <HomeHeader />
          <CreateChartOptions />
        </main>
        <Footer />
      </div>
    </div>
  );
}
