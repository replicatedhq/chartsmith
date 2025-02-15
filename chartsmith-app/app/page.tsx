"use client";

import React, { useEffect } from "react";
import { Footer } from "@/components/Footer";
import { HomeHeader } from "@/components/HomeHeader";
import { CreateChartOptions } from "@/components/CreateChartOptions";
import { HomeNav } from "@/components/HomeNav";
import { useSetAtom, useAtomValue } from 'jotai';
import { messagesAtom, plansAtom, rendersAtom, workspaceAtom } from '@/atoms/workspace';

export default function HomePage() {
  const workspace = useAtomValue(workspaceAtom);
  const setWorkspace = useSetAtom(workspaceAtom);
  const setMessages = useSetAtom(messagesAtom);
  const setPlans = useSetAtom(plansAtom);
  const setRenders = useSetAtom(rendersAtom);

  useEffect(() => {
    if (workspace !== null) {
      setWorkspace(null);
      setMessages([]);
      setPlans([]);
      setRenders([]);
    }
  }, [workspace, setWorkspace, setMessages, setPlans, setRenders]);

  return (
    <div
      className="min-h-screen bg-black text-white bg-cover bg-center bg-no-repeat flex flex-col"
      style={{
        backgroundImage: 'url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=2072")',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70" />

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
