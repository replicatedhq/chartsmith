"use client";

import React, { useRef, useEffect, useState, useLayoutEffect } from "react";

interface ScrollingContentProps {
  children: React.ReactNode;
  forceScroll?: boolean;
}

export function ScrollingContent({ children, forceScroll = false }: ScrollingContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const isUserScrollingRef = useRef(false);
  const lastContentRef = useRef("");
  
  // Set up scroll detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimer: NodeJS.Timeout | null = null;
    
    const handleScroll = () => {
      // Mark as actively scrolling
      isUserScrollingRef.current = true;
      
      // Consider "at bottom" when within 100px of the bottom
      const isAtBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 100;
      setShouldAutoScroll(isAtBottom);
      
      // Clear the existing timer
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }
      
      // Set a new timer to mark scrolling as done after a brief pause
      scrollTimer = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 200);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }
    };
  }, []);

  // Simple function to scroll to bottom
  const scrollToBottom = () => {
    const container = containerRef.current;
    if (!container) return;
    
    // Don't auto-scroll if user is actively scrolling
    if (isUserScrollingRef.current) return;
    
    container.scrollTop = container.scrollHeight;
  };

  // Auto-scroll when children change
  useLayoutEffect(() => {
    if (shouldAutoScroll || forceScroll) {
      // Don't scroll if user is actively scrolling
      if (isUserScrollingRef.current) return;
      
      // Scroll immediately
      scrollToBottom();
      
      // Try scrolling with multiple delays to handle dynamic content
      // This helps ensure content is fully rendered before scrolling
      [50, 200, 500, 1000].forEach(delay => {
        setTimeout(() => {
          if (!isUserScrollingRef.current) {
            scrollToBottom();
          }
        }, delay);
      });
    }
  }, [children, shouldAutoScroll, forceScroll]);

  // Use a mutation observer to catch DOM changes from streaming updates
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Keep track of mutations to batch them
    let contentChanged = false;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const handleContentChange = () => {
      if (!contentChanged) return;
      contentChanged = false;
      
      const container = containerRef.current;
      if (!container) return;
      
      // Only auto-scroll if user isn't actively scrolling
      if (!isUserScrollingRef.current && (shouldAutoScroll || forceScroll)) {
        scrollToBottom();
      }
    };
    
    const observer = new MutationObserver((mutations) => {
      // Only care about actual content changes
      const hasTextChanges = mutations.some(mutation => 
        mutation.type === 'characterData' || 
        mutation.addedNodes.length > 0 ||
        mutation.removedNodes.length > 0
      );
      
      if (hasTextChanges) {
        contentChanged = true;
        
        // Debounce scrolling to avoid too many scroll events
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(handleContentChange, 100);
      }
    });
    
    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    
    return () => {
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
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