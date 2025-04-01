"use client";

import React, { useRef, useEffect, useState, useLayoutEffect } from "react";
import { ChevronDown } from "lucide-react";

interface ScrollingContentProps {
  children: React.ReactNode;
  forceScroll?: boolean;
}

export function ScrollingContent({ children, forceScroll = false }: ScrollingContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isUserScrollingRef = useRef(false);
  const hasScrolledUpRef = useRef(false);
  const initialScrollCompleteRef = useRef(false);
  const lastContentRef = useRef("");
  
  // Simple function to scroll to bottom
  const scrollToBottom = () => {
    const container = containerRef.current;
    if (!container) return;
    
    container.scrollTop = container.scrollHeight;
    
    // After manually scrolling to bottom, we should re-enable auto-scroll
    if (hasScrolledUpRef.current) {
      setShouldAutoScroll(true);
      hasScrolledUpRef.current = false;
      setShowScrollButton(false);
    }
  };
  
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
      const wasAutoScrolling = shouldAutoScroll;
      
      // Only update scroll state if initial scroll is complete
      if (initialScrollCompleteRef.current) {
        setShouldAutoScroll(isAtBottom);
        
        // If user scrolls up and we were auto-scrolling, mark as scrolled up
        if (!isAtBottom && wasAutoScrolling) {
          hasScrolledUpRef.current = true;
          setShowScrollButton(true);
        }
        
        // If user scrolls to bottom, hide the button
        if (isAtBottom) {
          setShowScrollButton(false);
        }
      }
      
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
  }, [shouldAutoScroll]);

  // Handle initial render and allow first scroll
  useEffect(() => {
    // Set a timeout to mark initial scroll as complete
    const initialTimer = setTimeout(() => {
      initialScrollCompleteRef.current = true;
    }, 1500); // Allow enough time for first content to load and scroll
    
    return () => clearTimeout(initialTimer);
  }, []);

  // Auto-scroll when children change
  useLayoutEffect(() => {
    if (shouldAutoScroll || forceScroll) {
      // Don't scroll if user is actively scrolling
      if (isUserScrollingRef.current) return;
      
      // Scroll immediately
      scrollToBottom();
      
      // Try scrolling with just one delay to reduce jumpiness
      // This ensures content has time to render
      setTimeout(() => {
        if (!isUserScrollingRef.current && (shouldAutoScroll || forceScroll)) {
          scrollToBottom();
        }
      }, 100);
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
    <div className="relative w-full h-full">
      <div 
        ref={containerRef} 
        className="overflow-auto w-full h-full"
        style={{ scrollBehavior: 'smooth' }}
      >
        {children}
        {/* Extra space to ensure we can scroll past the content */}
        <div style={{ height: '10px', width: '100%' }} />
      </div>
      
      {/* Jump to latest button - positioned above the chat input */}
      {showScrollButton && (
        <button 
          onClick={scrollToBottom}
          className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white dark:bg-gray-950 
                     px-3 py-1.5 rounded-full shadow-xl border border-blue-400/40 dark:border-blue-300/30 flex items-center gap-1.5 text-xs font-medium
                     opacity-100 hover:scale-105 transition-all duration-200 z-30"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Jump to latest
        </button>
      )}
    </div>
  );
}