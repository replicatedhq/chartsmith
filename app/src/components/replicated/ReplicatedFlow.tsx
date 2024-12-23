import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useReplicated } from '../../contexts/ReplicatedContext';
import { SignInRequiredModal } from '../modals/SignInRequiredModal';
import { ReplicatedAuth } from './ReplicatedAuth';
import { AppSelector } from './AppSelector';
import { ChartSelector } from './ChartSelector';

interface App {
  id: string;
  name: string;
  description: string;
}

interface Chart {
  id: string;
  name: string;
  version: string;
}

export function ReplicatedFlow() {
  const { isAuthenticated: isUserAuthenticated } = useAuth();
  const { isAuthenticated: isReplicatedAuthenticated } = useReplicated();
  const navigate = useNavigate();
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(!isUserAuthenticated);

  const handleAppSelect = (app: App) => {
    setSelectedApp(app);
  };

  const handleChartSelect = (chart: Chart) => {
    navigate('/editor');
  };

  if (showSignInModal) {
    return (
      <SignInRequiredModal
        isOpen={true}
        onClose={() => setShowSignInModal(false)}
      />
    );
  }

  if (!isReplicatedAuthenticated) {
    return <ReplicatedAuth onAuthenticated={() => {}} />;
  }

  if (!selectedApp) {
    return <AppSelector onSelect={handleAppSelect} />;
  }

  return (
    <ChartSelector
      appName={selectedApp.name}
      onBack={() => setSelectedApp(null)}
      onSelect={handleChartSelect}
    />
  );
}