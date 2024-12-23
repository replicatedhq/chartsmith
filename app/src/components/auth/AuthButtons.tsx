import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { UserMenu } from './UserMenu';

export function AuthButtons() {
  const { isAuthenticated, signIn } = useAuth();
  const { theme } = useTheme();

  if (isAuthenticated) {
    return <UserMenu />;
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={signIn}
        className={`px-4 py-2 rounded-lg transition-colors ${
          theme === 'dark'
            ? 'text-gray-300 hover:text-white'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Sign In
      </button>
      <button
        onClick={signIn}
        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}