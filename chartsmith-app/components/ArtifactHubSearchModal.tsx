"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { searchArtifactHubAction } from "@/lib/workspace/actions/search-artifacthub";
import debounce from "lodash/debounce";
import { useSession } from "@/app/hooks/useSession";
import { useRouter } from "next/navigation";
import { createWorkspaceFromUrlAction } from "@/lib/workspace/actions/create-workspace-from-url";

interface ArtifactHubSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ArtifactHubSearchModal({ isOpen, onClose }: ArtifactHubSearchModalProps) {
  const { session } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isImporting, setIsImporting] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const searchResults = await searchArtifactHubAction(query);
        setResults(searchResults);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  // Handle input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    if (value.trim()) {
      setIsSearching(true);  // Set searching immediately when there's input
      debouncedSearch(value);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  };

  const handleChartSelect = async (url: string) => {
    if (!session) {
      // Store the URL and redirect to login
      sessionStorage.setItem('pendingArtifactHubUrl', url);
      router.push('/login');
      return;
    }

    try {
      setIsImporting(true);
      const workspace = await createWorkspaceFromUrlAction(session, url);
      router.push(`/workspace/${workspace.id}`);
    } catch (error) {
      console.error('Failed to create workspace:', error);
      setIsImporting(false);
    }
  };

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : prev
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleChartSelect(results[selectedIndex]);
        }
        break;
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Focus search input when modal opens
      searchInputRef.current?.focus();

      // Add ESC key handler
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mt-72 px-4">
        <div className="relative animate-in slide-in-from-top-4 duration-200">
          {/* Search input */}
          <div className="relative flex items-center">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter a chart URL from Artifact Hub"
              className="w-full h-14 pl-12 pr-12 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-xl"
            />
            <Search className={`absolute left-4 w-5 h-5 ${isSearching ? 'text-blue-400 animate-pulse' : 'text-gray-400'}`} />
            <button
              onClick={onClose}
              className="absolute right-4 p-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results panel */}
          {search && (
            <div className="absolute w-full mt-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden">
              <div className="max-h-[60vh] overflow-y-auto">
                {isImporting ? (
                  <div className="p-4 text-gray-400 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Importing Helm chart...
                  </div>
                ) : isSearching ? (
                  <div className="p-4 text-gray-400 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Validating...
                  </div>
                ) : results.length > 0 ? (
                  <div className="divide-y divide-gray-800">
                    {results.map((chart, index) => (
                      <button
                        key={index}
                        onClick={() => handleChartSelect(chart)}
                        disabled={isSearching || isImporting}
                        className={`w-full p-4 text-left hover:bg-gray-800/50 text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed
                          ${selectedIndex === index ? 'bg-gray-800/50 text-white' : ''}`}
                      >
                        {chart}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-gray-400">
                    Not a valid ArtifactHub package
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
