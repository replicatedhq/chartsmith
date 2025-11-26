"use client";

/**
 * ScrollingContent - A component that handles automatic scrolling behavior
 * 
 * Behavior specs:
 * 1. Auto-scrolls to bottom when new content is added
 * 2. Stops auto-scrolling when user manually scrolls up
 * 3. Shows "Jump to latest" button when user has scrolled up
 * 4. Re-enables auto-scroll when user clicks button or scrolls to bottom
 * 5. Never fights with user scroll - user intent always takes precedence
 * 
 * Performance optimizations:
 * - Uses requestAnimationFrame for smooth scroll updates
 * - Debounces rapid scroll events
 * - Uses passive event listeners where possible
 */

import React, { useRef, useEffect, useState, useLayoutEffect, useCallback, memo } from "react";
import { ChevronDown } from "lucide-react";

/** Minimum time between scroll updates (ms) for smooth 60fps */
const SCROLL_DEBOUNCE_MS = 16;

interface ScrollingContentProps {
  children: React.ReactNode;
  forceScroll?: boolean;
}

function ScrollingContentInner({ children, forceScroll = false }: ScrollingContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isUserScrollingRef = useRef(false);
  const hasScrolledUpRef = useRef(false);
  const initialScrollCompleteRef = useRef(false);
  const lastContentRef = useRef("");
  
  // Performance optimization refs
  const rafIdRef = useRef<number | null>(null);
  const lastScrollTimeRef = useRef<number>(0);
  
  // Update test helpers if in test environment
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'test') {
      (window as any).__scrollTestState = {
        isAutoScrollEnabled: () => shouldAutoScroll,
        hasScrolledUp: () => hasScrolledUpRef.current,
        isShowingJumpButton: () => showScrollButton
      };
    }
  }, [shouldAutoScroll, showScrollButton]);
  
  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);
  
  // Optimized scroll to bottom using requestAnimationFrame
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Use RAF for smooth scrolling
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    rafIdRef.current = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      rafIdRef.current = null;
    });
    
    // After manually scrolling to bottom, we should re-enable auto-scroll
    if (hasScrolledUpRef.current) {
      setShouldAutoScroll(true);
      hasScrolledUpRef.current = false;
      setShowScrollButton(false);
    }
  }, []);
  
  // Set up scroll detection with stronger user intent detection
  // Uses passive event listener for better scroll performance
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimer: NodeJS.Timeout | null = null;
    
    const handleScroll = () => {
      // Debounce rapid scroll events for performance
      const now = performance.now();
      if (now - lastScrollTimeRef.current < SCROLL_DEBOUNCE_MS) {
        return;
      }
      lastScrollTimeRef.current = now;
      
      // Mark as actively scrolling
      isUserScrollingRef.current = true;
      
      // Consider "at bottom" when within 100px of the bottom
      const isAtBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 100;
      const wasAutoScrolling = shouldAutoScroll;
      
      // Only update scroll state if initial scroll is complete
      if (initialScrollCompleteRef.current) {
        // If user is scrolling manually (not by auto-scroll)
        if (!isAtBottom) {
          // Disable auto-scroll when user manually scrolls up
          if (wasAutoScrolling) {
            setShouldAutoScroll(false);
            hasScrolledUpRef.current = true;
            setShowScrollButton(true);
          }
        } else if (isAtBottom) {
          // If user scrolls to bottom manually, re-enable auto-scroll and hide button
          setShouldAutoScroll(true);
          hasScrolledUpRef.current = false;
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

    // Use passive listener for better scroll performance
    container.addEventListener('scroll', handleScroll, { passive: true });
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

  // Auto-scroll when children change - more responsive but honors user scroll position
  useLayoutEffect(() => {
    // Don't try to scroll if user has explicitly scrolled up or is actively scrolling
    if (hasScrolledUpRef.current || isUserScrollingRef.current) return;
    
    // Only scroll if auto-scroll is enabled or if force scroll is set
    if (shouldAutoScroll || forceScroll) {
      // Scroll immediately
      scrollToBottom();
      
      // For more responsive scrolling, try multiple quick scrolls
      // This ensures we catch up with rapidly changing content
      const quickScroll = (attempts = 0) => {
        // Stop if we've made enough attempts, user is scrolling, or user has scrolled up
        if (attempts >= 3 || isUserScrollingRef.current || hasScrolledUpRef.current) return;
        
        setTimeout(() => {
          // Only continue if conditions are still right for auto-scrolling
          if (!isUserScrollingRef.current && !hasScrolledUpRef.current && (shouldAutoScroll || forceScroll)) {
            scrollToBottom();
            quickScroll(attempts + 1);
          }
        }, 50); // Faster interval between scrolls
      };
      
      quickScroll();
    }
  }, [children, shouldAutoScroll, forceScroll, scrollToBottom]);

  // Use a mutation observer to catch DOM changes from streaming updates
  useEffect(() => {
    if (!containerRef.current) return;
    
    // More responsive mutation handling for smoother scrolling
    let scrolling = false;
    let pendingScrolls = 0;
    const maxPendingScrolls = 3; // Limit rapid scrolls
    
    const handleContentChange = () => {
      if (scrolling || pendingScrolls >= maxPendingScrolls) return;
      
      const container = containerRef.current;
      if (!container) return;
      
      // Only auto-scroll if:
      // 1. User isn't actively scrolling
      // 2. User hasn't explicitly scrolled up
      // 3. Auto-scroll is enabled or force scroll is set
      if (!isUserScrollingRef.current && !hasScrolledUpRef.current && (shouldAutoScroll || forceScroll)) {
        scrolling = true;
        pendingScrolls++;
        
        scrollToBottom();
        
        // Reset scrolling flag quickly to allow more scroll attempts
        setTimeout(() => {
          scrolling = false;
          pendingScrolls = Math.max(0, pendingScrolls - 1);
        }, 30);
      }
    };
    
    const observer = new MutationObserver((mutations) => {
      // Immediately check for text changes and scroll
      const hasTextChanges = mutations.some(mutation => 
        mutation.type === 'characterData' || 
        mutation.addedNodes.length > 0 ||
        mutation.removedNodes.length > 0
      );
      
      if (hasTextChanges) {
        // Call immediately for faster response
        handleContentChange();
      }
    });
    
    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    
    return () => {
      observer.disconnect();
    };
  }, [shouldAutoScroll, forceScroll, scrollToBottom]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={containerRef} 
        className="overflow-auto w-full h-full"
        style={{ scrollBehavior: forceScroll ? 'auto' : 'smooth' }}
        data-testid="scroll-container"
      >
        {children}
        {/* Extra space to ensure we can scroll past the content */}
        <div style={{ height: '20px', width: '100%' }} />
      </div>
      
      {/* Jump to latest button - positioned above the chat input */}
      {showScrollButton && (
        <button 
          onClick={scrollToBottom}
          aria-label="Scroll to latest message"
          className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white dark:bg-gray-950 
                     px-3 py-1.5 rounded-full shadow-xl border border-blue-400/40 dark:border-blue-300/30 flex items-center gap-1.5 text-xs font-medium
                     hover:scale-105 transition-all duration-200 z-30 scroll-button-bounce"
          data-testid="jump-to-latest"
        >
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          Jump to latest
        </button>
      )}
    </div>
  );
}

/**
 * Memoized ScrollingContent component.
 * Uses default shallow comparison which properly detects children changes.
 */
export const ScrollingContent = memo(ScrollingContentInner);

// Expose test helpers for integration testing when in test environment
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'test') {
  (window as any).__scrollTestState = {
    isAutoScrollEnabled: () => false, // Will be properly initialized during component render
    hasScrolledUp: () => false,       // Will be properly initialized during component render
    isShowingJumpButton: () => false  // Will be properly initialized during component render
  };
}