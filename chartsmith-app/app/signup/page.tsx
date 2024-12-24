"use client"

import React from 'react';
import { GoogleButton } from '@/components/GoogleButton';
import { useTheme } from '@/contexts/ThemeContext';

export default function SignupPage() {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen ${
      theme === 'dark' ? 'bg-dark' : 'bg-gray-50'
    }`}>
      <main className="flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-text' : 'text-text'
            }`}>
              Get started
            </h1>
            <p className={`mt-3 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Create your ChartSmith account
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <GoogleButton />

            <div className="text-center">
              <span className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Already have an account?{' '}
                <a
                  href="/login"
                  className="font-medium text-primary hover:text-primary/90 transition-colors"
                >
                  Sign in
                </a>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
