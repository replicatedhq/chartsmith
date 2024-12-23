import React from 'react';
import { X, LogIn } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

interface SignInRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignInRequiredModal({ isOpen, onClose }: SignInRequiredModalProps) {
  const { theme } = useTheme();
  const { signIn } = useAuth();

  if (!isOpen) return null;

  const handleSignIn = () => {
    signIn();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className={`w-full max-w-md rounded-lg shadow-lg border ${
        theme === 'dark'
          ? 'bg-dark-surface border-dark-border'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark'
            ? 'border-dark-border'
            : 'border-gray-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Sign In Required
          </h2>
          <button
            onClick={onClose}
            className={`${
              theme === 'dark'
                ? 'text-gray-400 hover:text-white'
                : 'text-gray-500 hover:text-gray-700'
            } transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-3 rounded-lg ${
              theme === 'dark' ? 'bg-dark-border/40' : 'bg-gray-100'
            }`}>
              <LogIn className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className={`text-lg font-medium mb-1 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Authentication Required
              </h3>
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                Please sign in to access your Replicated charts
              </p>
            </div>
          </div>
          <button
            onClick={handleSignIn}
            className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
          >
            Sign In with Google
          </button>
        </div>
      </div>
    </div>
  );
}