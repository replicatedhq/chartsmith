import React from 'react';

const templates = [
  { name: "Web App", icon: "https://api.iconify.design/logos:kubernetes.svg" },
  { name: "Database", icon: "https://api.iconify.design/vscode-icons:file-type-mysql.svg" },
  { name: "Message Queue", icon: "https://api.iconify.design/logos:rabbitmq-icon.svg" },
  { name: "Monitoring", icon: "https://api.iconify.design/logos:prometheus.svg" },
  { name: "Logging", icon: "https://api.iconify.design/logos:elastic.svg" },
  { name: "Cache", icon: "https://api.iconify.design/logos:redis.svg" },
  { name: "API Gateway", icon: "https://api.iconify.design/logos:kong-icon.svg" },
  { name: "Service Mesh", icon: "https://api.iconify.design/logos:istio.svg" },
  { name: "Custom", icon: "https://api.iconify.design/logos:helm.svg" },
];

export function StackGrid() {
  return (
    <div className="mt-12">
      <p className="text-center text-gray-400 mb-6">
        or start with a template for your infrastructure needs
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-8 max-w-3xl mx-auto">
        {templates.map((template, index) => (
          <button
            key={index}
            className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-gray-800/40 transition-colors group"
          >
            <img src={template.icon} alt={template.name} className="w-8 h-8 mb-2" />
            <span className="text-sm text-gray-400 group-hover:text-gray-300">{template.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}