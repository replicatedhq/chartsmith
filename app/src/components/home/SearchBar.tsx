import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTypewriter } from '../../hooks/useTypewriter';

export function SearchBar() {
  const [input, setInput] = useState('');
  const [selectedExample, setSelectedExample] = useState('');
  const navigate = useNavigate();

  const handleComplete = useCallback(() => {
    if (selectedExample) {
      setInput(selectedExample);
      navigate('/editor');
    }
  }, [selectedExample, navigate]);

  const { displayText, isTyping } = useTypewriter({
    text: selectedExample,
    onComplete: handleComplete
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      navigate('/editor');
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example); // Set input immediately
    setSelectedExample(example);
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-8">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <input
            type="text"
            value={isTyping ? displayText : input}
            onChange={(e) => !isTyping && setInput(e.target.value)}
            placeholder="How can ChartSmith help with your Helm charts today?"
            className="w-full px-4 py-3 bg-gray-800/40 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-600"
            readOnly={isTyping}
          />
        </div>
      </form>
      <div className="mt-4 flex flex-col gap-2">
        <p className="text-sm text-gray-500">Try asking:</p>
        <div className="space-y-2">
          {[
            "Load my helm chart and look for recommendations",
            "Import my chart from my Replicated app",
            "Start a new helm chart"
          ].map((example, index) => (
            <button
              key={index}
              onClick={() => handleExampleClick(example)}
              className="block w-full text-left text-sm text-gray-400 hover:text-gray-300 transition-colors px-4 py-2 rounded-lg hover:bg-gray-800/40"
              disabled={isTyping}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}