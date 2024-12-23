import React from 'react';
import { LineChart, PieChart, BarChart } from 'lucide-react';

export function Hero() {
  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Transform Your Data into
            <span className="block text-indigo-200">Beautiful Visualizations</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-xl text-indigo-100">
            Create stunning charts and graphs with our intuitive tools. Perfect for analysts,
            researchers, and data enthusiasts.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <button className="bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors">
              Get Started
            </button>
            <button className="border border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors">
              View Templates
            </button>
          </div>
        </div>
        <div className="mt-20 flex justify-center space-x-12">
          <LineChart className="w-16 h-16 text-indigo-200" />
          <PieChart className="w-16 h-16 text-indigo-200" />
          <BarChart className="w-16 h-16 text-indigo-200" />
        </div>
      </div>
    </div>
  );
}