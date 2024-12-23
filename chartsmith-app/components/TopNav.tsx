"use client"
import React, { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/contexts/ThemeContext';
import { StatusDropdown } from './StatusDropdown';
import { CreateChartModal } from './CreateChartModal';

const evalItems = [
  { label: 'Helm Test', status: 'success' as const },
  { label: 'Helm Template', status: 'warning' as const },
  { label: 'K3s', status: 'error' as const },
  { label: 'EKS', status: 'loading' as const },
  { label: 'OpenShift', status: 'success' as const },
];

const importExportItems = [
  { label: 'Download' },
  { label: 'Work in CLI' },
  { label: 'Publish to Replicated' },
];

export function TopNav() {
  const [isChartDropdownOpen, setIsChartDropdownOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const handleMouseEnter = () => {
    setIsChartDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    setIsChartDropdownOpen(false);
  };

  return (
    <>
      <nav className={`h-14 border-b flex items-center justify-between px-4 relative z-50 ${
        theme === 'dark'
          ? 'border-dark-border bg-dark-surface'
          : 'border-gray-200 bg-white'
      }`}>
        <Link href="/" className={`flex items-center space-x-2 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="4" fill="#6a77fb"/>
            <path d="M7 7H11V11H7V7Z" fill="white"/>
            <path d="M13 7H17V11H13V7Z" fill="white"/>
            <path d="M7 13H11V17H7V13Z" fill="white"/>
            <path d="M13 13H17V17H13V13Z" fill="white"/>
          </svg>
          <div className="flex items-center">
            <span className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-900'
            } ml-2`}>ChartSmith</span>
            <span className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            } ml-2`}>by Replicated</span>
          </div>
        </Link>

        <div className="flex-1 flex justify-center">
          <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            ref={dropdownRef}
          >
            <button className={`px-3 py-1.5 text-sm flex items-center gap-2 rounded hover:bg-opacity-40 ${
              theme === 'dark'
                ? 'text-gray-300 hover:text-white hover:bg-dark-border'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}>
              my-helm-chart
              <ChevronDown className="w-4 h-4" />
            </button>

            {isChartDropdownOpen && (
              <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 rounded-lg shadow-lg border py-1 z-[60] ${
                theme === 'dark'
                  ? 'bg-dark-surface border-dark-border'
                  : 'bg-white border-gray-200'
              }`}>
                {/* ... dropdown content ... */}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <StatusDropdown
            label="Eval"
            items={evalItems}
            showStatus={true}
            theme={theme}
          />
          <StatusDropdown
            label="Import/Export"
            items={importExportItems}
            showStatus={false}
            theme={theme}
          />
        </div>
      </nav>

      <CreateChartModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
}
