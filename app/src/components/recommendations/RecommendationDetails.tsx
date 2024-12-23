import React, { useState } from 'react';
import { ArrowLeft, AlertTriangle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useRecommendation } from '../../hooks/useRecommendation';
import { CodePreview } from './CodePreview';
import { ExplanationCard } from './ExplanationCard';

interface RecommendationDetailsProps {
  id?: string;
  onBack: () => void;
}

export function RecommendationDetails({ id, onBack }: RecommendationDetailsProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { recommendation, explanation } = useRecommendation(id);
  const [isIgnored, setIsIgnored] = useState(false);

  if (!recommendation) {
    return <div>Recommendation not found</div>;
  }

  const typeIcons = {
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    error: <AlertTriangle className="w-5 h-5 text-error" />,
    info: <Info className="w-5 h-5 text-accent" />,
  };

  const importanceColors = {
    high: 'text-error',
    medium: 'text-yellow-500',
    low: 'text-accent',
  };

  const handleFixIssue = () => {
    const message = `Please help me fix this issue: ${recommendation.title}\n\nDescription: ${recommendation.description}\n\nAffected files: ${recommendation.files.join(', ')}`;
    sessionStorage.setItem('pendingChatMessage', message);
    navigate('/editor');
  };

  const handleIgnore = () => {
    setIsIgnored(true);
    // Add any additional ignore logic here
    setTimeout(() => {
      onBack();
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className={`flex items-center gap-2 ${
            theme === 'dark' 
              ? 'text-gray-400 hover:text-white' 
              : 'text-gray-600 hover:text-gray-900'
          } transition-colors`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Recommendations
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleFixIssue}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
          >
            Fix Issue
          </button>
          <button
            onClick={handleIgnore}
            className={`px-4 py-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'bg-dark-border/40 hover:bg-dark-border/60 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {isIgnored ? 'Ignoring...' : 'Ignore'}
          </button>
        </div>
      </div>

      <div className={`p-6 rounded-lg border ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className="mt-1">{typeIcons[recommendation.type]}</div>
          <div className="flex-1">
            <h1 className={`text-2xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {recommendation.title}
            </h1>
            <p className={`mb-4 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {recommendation.description}
            </p>
            <div className="flex items-center gap-4">
              <span className={`text-sm ${importanceColors[recommendation.importance]}`}>
                {recommendation.importance.charAt(0).toUpperCase() + recommendation.importance.slice(1)} Importance
              </span>
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Affects {recommendation.files.length} file{recommendation.files.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ExplanationCard explanation={explanation} />

      <div className="space-y-4">
        <h2 className={`text-lg font-semibold ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Affected Files
        </h2>
        {recommendation.files.map((file, index) => (
          <CodePreview key={index} filePath={file} />
        ))}
      </div>
    </div>
  );
}