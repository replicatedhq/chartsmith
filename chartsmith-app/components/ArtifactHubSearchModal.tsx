"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, X, Flame, Package } from "lucide-react";
import { searchArtifactHubAction } from "@/lib/workspace/actions/search-artifacthub";
import debounce from "lodash/debounce";
import { useSession } from "@/app/hooks/useSession";
import { useRouter } from "next/navigation";
import { createWorkspaceFromUrlAction } from "@/lib/workspace/actions/create-workspace-from-url";
import { logger } from "@/lib/utils/logger";

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

  // Create a memoized search handler
  const searchHandler = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await searchArtifactHubAction(query);
      setResults(searchResults);
    } catch (error) {
      logger.error('Search failed', { error });
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Create memoized debounced function
  const debouncedSearch = useMemo(
    () => debounce(searchHandler, 300),
    [searchHandler]
  );

  // Cleanup debounced function
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

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
      logger.error('Failed to create workspace', { error });
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
      {/* Backdrop with ember tint */}
      <div
        className="absolute inset-0 bg-forge-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mt-48 px-4">
        <div className="relative animate-in slide-in-from-top-4 duration-200">
          {/* Search input with forge styling */}
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-forge-ember/30 via-forge-ember/10 to-forge-ember/30 rounded-forge-lg blur opacity-60" />
            <div className="relative flex items-center">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                placeholder="Search Artifact Hub for Helm charts..."
                className="
                  w-full h-14 pl-12 pr-12
                  bg-forge-charcoal/95 backdrop-blur-sm
                  border border-forge-iron rounded-forge-lg
                  text-stone-100 placeholder-forge-zinc
                  focus:outline-none focus:ring-2 focus:ring-forge-ember/50 focus:border-forge-ember/50
                  shadow-xl font-body
                "
              />
              <Search className={`absolute left-4 w-5 h-5 ${isSearching ? 'text-forge-ember animate-pulse' : 'text-forge-zinc'}`} />
              <button
                onClick={onClose}
                className="absolute right-4 p-1.5 text-forge-zinc hover:text-stone-100 hover:bg-forge-iron/50 rounded-forge transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Results panel with forge styling */}
          {search && (
            <div className="absolute w-full mt-2 bg-forge-charcoal/95 backdrop-blur-sm border border-forge-iron rounded-forge-lg overflow-hidden shadow-2xl">
              <div className="max-h-[60vh] overflow-y-auto">
                {isImporting ? (
                  <div className="p-4 text-forge-silver flex items-center gap-3">
                    <Flame className="w-5 h-5 text-forge-ember animate-pulse" />
                    <span className="font-medium">Forging workspace from chart...</span>
                  </div>
                ) : isSearching ? (
                  <div className="p-4 text-forge-silver flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-forge-ember border-t-transparent rounded-full animate-spin" />
                    <span>Searching the forge...</span>
                  </div>
                ) : results.length > 0 ? (
                  <div>
                    <div className="px-4 py-3 bg-forge-iron/30 text-forge-silver text-xs border-b border-forge-iron flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-forge-ember" />
                      {results.length} chart{results.length > 1 ? 's' : ''} found matching &quot;{search}&quot;
                    </div>
                    <div className="divide-y divide-forge-iron/50">
                      {results.map((chart, index) => {
                        const chartUrl = new URL(chart);
                        const chartPath = chartUrl.pathname.split('/');
                        const repoName = chartPath[chartPath.length - 2] || "";
                        const chartName = chartPath[chartPath.length - 1] || "";

                        return (
                          <button
                            key={index}
                            onClick={() => handleChartSelect(chart)}
                            disabled={isSearching || isImporting}
                            className={`
                              w-full p-4 text-left transition-all
                              disabled:opacity-50 disabled:cursor-not-allowed
                              ${selectedIndex === index
                                ? 'bg-forge-ember/10 text-stone-100 border-l-2 border-forge-ember'
                                : 'text-forge-silver hover:bg-forge-iron/40 hover:text-stone-100 border-l-2 border-transparent'
                              }
                            `}
                          >
                            <div className="flex items-center gap-3">
                              <Package className="w-4 h-4 text-forge-ember flex-shrink-0" />
                              <span className="font-medium font-mono text-sm">{repoName}/{chartName}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : search.length > 2 ? (
                  <div className="p-4 text-forge-zinc text-center">
                    No charts found matching &quot;{search}&quot;
                  </div>
                ) : (
                  <div className="p-4 text-forge-zinc text-center text-sm">
                    Enter at least 3 characters to search
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
