import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export function GoogleButton() {
  const { theme } = useTheme();
  const handleGoogleSignIn = () => {
    // Google sign-in logic will be implemented here
    console.log('Google sign-in clicked');
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      className={`flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2.5 font-medium transition-colors ${
        theme === 'dark'
          ? 'bg-surface text-text border border-dark-border hover:bg-dark-border/40'
          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
    >
      <img
        src="https://www.google.com/favicon.ico"
        alt="Google"
        className="w-5 h-5"
      />
      Continue with Google
    </button>
  );
}
