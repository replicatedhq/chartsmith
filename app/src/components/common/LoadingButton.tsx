import React, { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface LoadingButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function LoadingButton({ onClick, disabled, children, className = '' }: LoadingButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        setIsSuccess(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

  const handleClick = async () => {
    setIsLoading(true);
    await onClick();
    setIsLoading(false);
    setIsSuccess(true);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 ${className}`}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {isSuccess && <Check className="w-4 h-4" />}
      {children}
    </button>
  );
}