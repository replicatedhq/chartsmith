import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TopNav } from '../components/layout/TopNav';
import { RecommendationDetails } from '../components/recommendations/RecommendationDetails';
import { useTheme } from '../contexts/ThemeContext';

export function RecommendationDetailsPage() {
  const { id } = useParams();
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-dark' : 'bg-white'}`}>
      <TopNav />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <RecommendationDetails id={id} onBack={() => navigate('/recommendations')} />
        </div>
      </div>
    </div>
  );
}