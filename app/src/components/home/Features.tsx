import React from 'react';
import { Sparkles, Palette, Share2, Gauge } from 'lucide-react';

const features = [
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: 'Smart Suggestions',
    description: 'AI-powered chart recommendations based on your data structure.'
  },
  {
    icon: <Palette className="h-6 w-6" />,
    title: 'Custom Themes',
    description: 'Create and save your own color palettes and styling preferences.'
  },
  {
    icon: <Share2 className="h-6 w-6" />,
    title: 'Easy Sharing',
    description: 'Export charts in multiple formats or share via direct links.'
  },
  {
    icon: <Gauge className="h-6 w-6" />,
    title: 'Real-time Updates',
    description: 'Charts automatically update as your data changes.'
  }
];

export function Features() {
  return (
    <div className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Powerful Features for Data Visualization
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Everything you need to create professional charts and graphs.
          </p>
        </div>
        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="relative p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}