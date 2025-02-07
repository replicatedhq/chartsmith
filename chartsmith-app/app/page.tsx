"use client";

import React from "react";
import { Footer } from "@/components/Footer";
import { useTheme } from "@/contexts/ThemeContext";
import { HomeHeader } from "@/components/HomeHeader";
import { CreateChartOptions } from "@/components/CreateChartOptions";
import { HomeNav } from "@/components/HomeNav";

export default function HomePage() {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-dark" : "bg-gray-50"}`}>
      <div className="max-w-7xl mx-auto pt-8">
        <HomeNav />
        <div className="pt-4">
          <HomeHeader />
          <CreateChartOptions />
        </div>
      </div>
      <Footer />
    </div>
  );
}
