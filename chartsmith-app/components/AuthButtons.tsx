"use client"
import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { UserMenu } from './UserMenu';

export function AuthButtons() {
  const { isAuthenticated, signIn } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  if (isAuthenticated) {
    return <UserMenu />;
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => router.push('/login')}
        className={`px-4 py-2 rounded-lg transition-colors ${
          theme === 'dark'
            ? 'text-gray-300 hover:text-white'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Log In
      </button>
      <button
        onClick={() => router.push('/signup')}
        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}
