"use client";

import React, { useState } from "react";
import { Footer } from "@/components/Footer";
import { useTheme } from "@/contexts/ThemeContext";
import { HomeHeader } from "@/components/HomeHeader";
import { CreateChartOptions } from "@/components/CreateChartOptions";
import { HomeNav } from "@/components/HomeNav";

export default function HomePage() {
  const { theme } = useTheme();

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
