"use client";

import { useState, memo } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  theme: string;
}

/**
 * Code block component with syntax highlighting and copy button.
 *
 * Accessibility:
 * - Proper code/pre semantic elements
 * - Accessible copy button with status announcement
 * - Language label for context
 */
export const CodeBlock = memo(function CodeBlock({
  children,
  className,
  theme
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeContent = String(children).replace(/\n$/, '');

  // Extract language from className (e.g., "language-yaml" -> "yaml")
  const language = className?.replace('language-', '') || '';
  const isYamlOrHelm = ['yaml', 'yml', 'helm'].includes(language.toLowerCase());

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeContent);
    setCopied(true);
    // Announce to screen readers
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple YAML syntax highlighting
  const highlightYaml = (code: string) => {
    return code.split('\n').map((line, i) => {
      // Highlight comments
      if (line.trim().startsWith('#')) {
        return <span key={i} className="text-gray-500">{line}{'\n'}</span>;
      }

      // Highlight key-value pairs
      const keyValueMatch = line.match(/^(\s*)([^:]+)(:)(.*)$/);
      if (keyValueMatch) {
        const [, indent, key, colon, value] = keyValueMatch;
        const trimmedValue = value.trim();

        // Check for Helm template expressions
        const helmMatch = trimmedValue.match(/^(\{\{.*\}\})$/);
        if (helmMatch) {
          return (
            <span key={i}>
              {indent}
              <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>{key}</span>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{colon}</span>
              <span className={theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}>{value}</span>
              {'\n'}
            </span>
          );
        }

        // Check for string values
        if (trimmedValue.startsWith('"') || trimmedValue.startsWith("'")) {
          return (
            <span key={i}>
              {indent}
              <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>{key}</span>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{colon}</span>
              <span className={theme === 'dark' ? 'text-green-400' : 'text-green-600'}>{value}</span>
              {'\n'}
            </span>
          );
        }

        // Check for numeric values
        if (/^\s*\d+/.test(trimmedValue)) {
          return (
            <span key={i}>
              {indent}
              <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>{key}</span>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{colon}</span>
              <span className={theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}>{value}</span>
              {'\n'}
            </span>
          );
        }

        // Check for boolean values
        if (['true', 'false'].includes(trimmedValue.toLowerCase())) {
          return (
            <span key={i}>
              {indent}
              <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>{key}</span>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{colon}</span>
              <span className={theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}>{value}</span>
              {'\n'}
            </span>
          );
        }

        // Default key-value
        return (
          <span key={i}>
            {indent}
            <span className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>{key}</span>
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{colon}</span>
            <span>{value}</span>
            {'\n'}
          </span>
        );
      }

      // Default line
      return <span key={i}>{line}{'\n'}</span>;
    });
  };

  return (
    <div className="relative group my-2">
      {language && (
        <div
          className={`absolute top-0 left-0 px-2 py-0.5 text-xs rounded-br ${
            theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
          }`}
        >
          {language}
        </div>
      )}
      <button
        onClick={handleCopy}
        className={`absolute top-1 right-1 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
          theme === 'dark'
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
        }`}
        aria-label={copied ? 'Copied!' : 'Copy code'}
        title={copied ? 'Copied!' : 'Copy code'}
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-500" aria-hidden="true" />
        ) : (
          <Copy className="w-4 h-4" aria-hidden="true" />
        )}
        <span className="sr-only">{copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}</span>
      </button>
      <pre
        className={`p-3 pt-6 rounded overflow-x-auto text-sm font-mono ${
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
        }`}
      >
        <code className={className}>
          {isYamlOrHelm ? highlightYaml(codeContent) : codeContent}
        </code>
      </pre>
    </div>
  );
});
