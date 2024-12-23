import React from 'react';
import { BarChart2 } from 'lucide-react';
import { NavLink } from './NavLink';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <BarChart2 className="h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">ChartSmith</span>
          </div>
          <nav className="flex space-x-8">
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/create">Create</NavLink>
            <NavLink href="/templates">Templates</NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}