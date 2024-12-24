"use client"

import React, { useState } from 'react';
import { AlertTriangle, Info, ArrowUpDown, ChevronDown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useParams, useRouter } from 'next/navigation';
import { TopNav } from '@/components/TopNav';

interface Recommendation {
  id: number;
  title: string;
  description: string;
  files: string[];
  importance: 'high' | 'medium' | 'low';
  type: 'warning' | 'error' | 'info';
  ignored?: boolean;
}

const initialRecommendations: Recommendation[] = [
  {
    id: 1,
    title: 'Resource Limits Not Set',
    description: 'Your deployment.yaml is missing resource limits. This is important for proper resource management.',
    files: ['templates/deployment.yaml'],
    importance: 'high',
    type: 'warning',
  },
  {
    id: 2,
    title: 'Invalid API Version',
    description: 'The API version specified in your ingress.yaml may be deprecated in newer Kubernetes versions.',
    files: ['templates/ingress.yaml'],
    importance: 'high',
    type: 'error',
  },
  {
    id: 3,
    title: 'Consider Adding Health Checks',
    description: 'Adding readiness and liveness probes can improve container lifecycle management.',
    files: ['templates/deployment.yaml'],
    importance: 'medium',
    type: 'info',
  },
  {
    id: 4,
    title: 'Missing Labels',
    description: 'Common Kubernetes labels are missing from your resources.',
    files: ['templates/deployment.yaml', 'templates/service.yaml'],
    importance: 'low',
    type: 'info',
  },
];

type SortField = 'title' | 'importance';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'high' | 'ignored';

export default function RecommendationsPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const [recommendations, setRecommendations] = useState<Recommendation[]>(initialRecommendations);
  const [sortField, setSortField] = useState<SortField>('importance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleIgnore = (id: number) => {
    setRecommendations(prev =>
      prev.map(rec =>
        rec.id === id ? { ...rec, ignored: !rec.ignored } : rec
      )
    );
  };

  const handleFilterSelect = (type: FilterType) => {
    setFilterType(type);
    setIsDropdownOpen(false);
  };

  const handleFixIssue = (recommendation: Recommendation) => {
    const message = `Please help me fix this issue: ${recommendation.title}\n\nDescription: ${recommendation.description}\n\nAffected files: ${recommendation.files.join(', ')}`;
    sessionStorage.setItem('pendingChatMessage', message);
    router.push(`/workspace/${params.id}`)
  };

  const filteredRecommendations = recommendations.filter(rec => {
    switch (filterType) {
      case 'high':
        return rec.importance === 'high' && !rec.ignored;
      case 'ignored':
        return rec.ignored;
      default:
        return !rec.ignored;
    }
  });

  const sortedRecommendations = [...filteredRecommendations].sort((a, b) => {
    const importanceOrder = { high: 3, medium: 2, low: 1 };

    if (sortField === 'importance') {
      const comparison = importanceOrder[b.importance] - importanceOrder[a.importance];
      return sortDirection === 'asc' ? -comparison : comparison;
    } else {
      const comparison = a[sortField].localeCompare(b[sortField]);
      return sortDirection === 'asc' ? comparison : -comparison;
    }
  });

  const typeIcons = {
    warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    error: <AlertTriangle className="w-4 h-4 text-error" />,
    info: <Info className="w-4 h-4 text-accent" />,
  };

  const importanceColors = {
    high: 'text-error',
    medium: 'text-yellow-500',
    low: 'text-accent',
  };

  return (
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-dark' : 'bg-white'}`}>
      <TopNav />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Recommendations
            </h1>
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
                  theme === 'dark'
                    ? 'bg-dark-surface border-dark-border text-gray-300'
                    : 'bg-white border-gray-200 text-gray-700'
                } border`}
              >
                {filterType === 'all' && 'All Issues'}
                {filterType === 'high' && 'High Importance Issues'}
                {filterType === 'ignored' && 'Ignored Issues'}
                <ChevronDown className="w-4 h-4" />
              </button>
              {isDropdownOpen && (
                <div className={`absolute right-0 mt-1 w-48 rounded-lg shadow-lg border py-1 z-10 ${
                  theme === 'dark'
                    ? 'bg-dark-surface border-dark-border'
                    : 'bg-white border-gray-200'
                }`}>
                  {['All Issues', 'High Importance Issues', 'Ignored Issues'].map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleFilterSelect(
                        option === 'All Issues'
                          ? 'all'
                          : option === 'High Importance Issues'
                            ? 'high'
                            : 'ignored'
                      )}
                      className={`w-full px-4 py-2 text-left text-sm ${
                        theme === 'dark'
                          ? 'text-gray-300 hover:bg-dark-border/40'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`rounded-lg overflow-hidden border ${
            theme === 'dark'
              ? 'bg-dark-surface border-dark-border'
              : 'bg-white border-gray-200'
          }`}>
            <table className="w-full">
              <thead>
                <tr className={`border-b ${
                  theme === 'dark' ? 'border-dark-border' : 'border-gray-200'
                }`}>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-8 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}></th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer group ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`} onClick={() => handleSort('title')}>
                    <div className="flex items-center gap-2">
                      Title
                      <ArrowUpDown className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Description
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    File(s)
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer group ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`} onClick={() => handleSort('importance')}>
                    <div className="flex items-center gap-2">
                      Importance
                      <ArrowUpDown className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </th>
                  <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${
                theme === 'dark' ? 'divide-dark-border' : 'divide-gray-200'
              }`}>
                {sortedRecommendations.map((rec) => (
                  <tr key={rec.id} className={
                    theme === 'dark'
                      ? 'hover:bg-dark-border/20'
                      : 'hover:bg-gray-50'
                  }>
                    <td className="px-6 py-4">
                      {typeIcons[rec.type]}
                    </td>
                    <td className={`px-6 py-4 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      <button
                        onClick={() => navigate(`/recommendations/${rec.id}`)}
                        className="text-left hover:underline"
                      >
                        {rec.title}
                      </button>
                    </td>
                    <td className={`px-6 py-4 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {rec.description}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {rec.files.map((file, index) => (
                          <div key={index} className={`text-sm ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {file}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`capitalize ${importanceColors[rec.importance]}`}>
                        {rec.importance}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleFixIssue(rec)}
                        className="px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
                      >
                        Fix Issue
                      </button>
                      <button
                        onClick={() => handleIgnore(rec.id)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          theme === 'dark'
                            ? 'bg-dark-border/40 hover:bg-dark-border/60 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {rec.ignored ? 'Unignore' : 'Ignore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
