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
    <div className="min-h-screen bg-forge-black text-white flex flex-col relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="fixed inset-0 pattern-grid opacity-30 pointer-events-none" />

      {/* Ember glow at bottom */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-30 pointer-events-none">
        <div className="absolute inset-0 blur-[120px] bg-gradient-to-t from-forge-ember via-forge-ember/40 to-transparent rounded-full" />
      </div>

      {/* Subtle side glows */}
      <div className="fixed top-1/4 -left-32 w-64 h-64 bg-forge-ember/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-1/4 -right-32 w-64 h-64 bg-forge-ember/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative flex-1 flex flex-col z-10">
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
