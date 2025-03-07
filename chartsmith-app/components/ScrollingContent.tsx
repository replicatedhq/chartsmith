"use client";

import React, { useRef, useEffect, useState, useLayoutEffect } from "react";

interface ScrollingContentProps {
  children: React.ReactNode;
  forceScroll?: boolean;
}

export function ScrollingContent({ children, forceScroll = false }: ScrollingContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Set up scroll detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Consider "at bottom" when within 100px of the bottom
      const isAtBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 100;
      setShouldAutoScroll(isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Simple function to scroll to bottom
  const scrollToBottom = () => {
    const container = containerRef.current;
    if (!container) return;
    
    container.scrollTop = container.scrollHeight;
  };

  // Auto-scroll when children change (simpler approach)
  useLayoutEffect(() => {
    if (shouldAutoScroll || forceScroll) {
      // Scroll immediately
      scrollToBottom();
      
      // Also try scrolling after a short delay to catch any content that's still loading
      setTimeout(scrollToBottom, 50);
      setTimeout(scrollToBottom, 300);
    }
  }, [children, shouldAutoScroll, forceScroll]);

  // Use a mutation observer to catch DOM changes from streaming updates
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new MutationObserver(() => {
      if (shouldAutoScroll || forceScroll) {
        scrollToBottom();
      }
    });
    
    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    
    return () => observer.disconnect();
  }, [shouldAutoScroll, forceScroll]);

  return (
    <div 
      ref={containerRef} 
      className="overflow-auto w-full h-full"
      style={{ scrollBehavior: 'smooth' }}
    >
      {children}
      {/* Extra space to ensure we can scroll past the content */}
      <div style={{ height: '10px', width: '100%' }} />
    </div>
  );
}