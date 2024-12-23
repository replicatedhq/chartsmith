import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPage() {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen py-16 px-4 ${theme === 'dark' ? 'bg-dark' : 'bg-white'}`}>
      <div className="max-w-4xl mx-auto">
        <Link 
          to="/" 
          className={`inline-flex items-center gap-2 mb-8 ${
            theme === 'dark' 
              ? 'text-gray-400 hover:text-white' 
              : 'text-gray-600 hover:text-gray-900'
          } transition-colors`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <h1 className={`text-3xl font-bold mb-8 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Privacy Policy
        </h1>
        <div className={`prose ${theme === 'dark' ? 'prose-invert' : ''} max-w-none space-y-6`}>
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>

          <h2 className={`text-xl font-semibold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            1. Information We Collect
          </h2>
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
          </p>

          <h2 className={`text-xl font-semibold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            2. How We Use Your Information
          </h2>
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
          </p>

          <h2 className={`text-xl font-semibold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            3. Data Security
          </h2>
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
            Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
          </p>
        </div>
      </div>
    </div>
  );
}