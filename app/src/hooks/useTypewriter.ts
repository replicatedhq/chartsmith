import { useState, useEffect, useCallback } from 'react';

interface UseTypewriterOptions {
  text: string;
  delay?: number;
  onComplete?: () => void;
}

export function useTypewriter({ text, delay = 30, onComplete }: UseTypewriterOptions) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const startTyping = useCallback(() => {
    if (!text) return;
    
    setIsTyping(true);
    let currentIndex = 0;

    const type = () => {
      if (currentIndex < text.length) {
        setDisplayText(text.slice(0, currentIndex + 1));
        currentIndex++;
        setTimeout(type, delay);
      } else {
        setIsTyping(false);
        setTimeout(() => {
          onComplete?.();
        }, 500);
      }
    };

    type();
  }, [text, delay, onComplete]);

  useEffect(() => {
    if (text) {
      startTyping();
    }
    return () => {
      setIsTyping(false);
    };
  }, [text, startTyping]);

  return { displayText, isTyping };
}