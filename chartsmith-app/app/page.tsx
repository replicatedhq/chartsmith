"use client";

import React from "react";
import { Footer } from "@/components/Footer";
import { useTheme } from "@/contexts/ThemeContext";
import { HomeHeader } from "@/components/HomeHeader";
import { CreateChartOptions } from "@/components/CreateChartOptions";

export default function HomePage() {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-dark" : "bg-gray-50"}`}>
      <div className="max-w-7xl mx-auto py-20">
        <HomeHeader />
        <CreateChartOptions />
      </div>
      <Footer />
    </div>
  );
}
