import React from 'react';

interface QuickAction {
  title: string;
  onClick: () => void;
}

const quickActions: QuickAction[] = [
  { title: "Create a new Helm chart", onClick: () => {} },
  { title: "Import existing chart", onClick: () => {} },
  { title: "Generate values.yaml", onClick: () => {} },
  { title: "Validate chart structure", onClick: () => {} },
  { title: "Package and sign chart", onClick: () => {} },
  { title: "Deploy to Kubernetes", onClick: () => {} },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-8">
      {quickActions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          className="px-4 py-2 text-sm text-gray-300 bg-gray-800/40 rounded-full hover:bg-gray-800/60 transition-colors"
        >
          {action.title}
        </button>
      ))}
    </div>
  );
}