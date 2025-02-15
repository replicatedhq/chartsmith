"use client";

import React, { useRef, useEffect, useState } from "react";

interface ScrollingContentProps {
  children: React.ReactNode;
}

export function ScrollingContent({ children }: ScrollingContentProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  useEffect(() => {
    const parent = messagesEndRef.current?.closest('.overflow-auto');
    if (!parent) return;

    const handleScroll = () => {
      const isAtBottom = parent.scrollHeight - parent.clientHeight - parent.scrollTop < 50;
      setShouldAutoScroll(isAtBottom);
    };

    parent.addEventListener('scroll', handleScroll);
    return () => parent.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current && shouldAutoScroll) {
      const parent = messagesEndRef.current.closest('.overflow-auto');
      if (parent) {
        parent.scrollTop = parent.scrollHeight;
      }
    }
  });

  return (
    <>
      {children}
      <div ref={messagesEndRef} />
    </>
  );
}
