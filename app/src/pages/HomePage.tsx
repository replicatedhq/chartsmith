import React from 'react';
import { HomeHeader } from '../components/home/HomeHeader';
import { CreateChartOptions } from '../components/home/CreateChartOptions';
import { Footer } from '../components/layout/Footer';
import { useTheme } from '../contexts/ThemeContext';

export function HomePage() {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen ${
      theme === 'dark' ? 'bg-dark' : 'bg-gray-50'
    }`}>
      <div className="max-w-7xl mx-auto py-20">
        <HomeHeader />
        <CreateChartOptions />
      </div>
      <Footer />
    </div>
  );
}