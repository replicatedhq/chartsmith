import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { EditorPage } from './pages/EditorPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { RecommendationDetailsPage } from './pages/RecommendationDetailsPage';
import { ValuesScenariosPage } from './pages/ValuesScenariosPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { Footer } from './components/layout/Footer';
import { SideNav } from './components/layout/SideNav';
import { useTheme } from './contexts/ThemeContext';

function Layout() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const isTermsPage = location.pathname === '/terms';
  const isPrivacyPage = location.pathname === '/privacy';
  const showSideNav = !isHomePage && !isTermsPage && !isPrivacyPage;
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isFileTreeVisible, setIsFileTreeVisible] = useState(true);
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-dark' : 'bg-white'} flex`}>
      {showSideNav && (
        <SideNav 
          isChatVisible={isChatVisible} 
          onToggleChat={() => setIsChatVisible(!isChatVisible)}
          isFileTreeVisible={isFileTreeVisible}
          onToggleFileTree={() => setIsFileTreeVisible(!isFileTreeVisible)}
        />
      )}
      <div className="flex-1">
        <Routes>
          <Route path="/" element={
            <>
              <HomePage />
              <Footer />
            </>
          } />
          <Route path="/editor" element={
            <EditorPage 
              isChatVisible={isChatVisible}
              isFileTreeVisible={isFileTreeVisible}
            />
          } />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/recommendations/:id" element={<RecommendationDetailsPage />} />
          <Route path="/values-scenarios" element={<ValuesScenariosPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}