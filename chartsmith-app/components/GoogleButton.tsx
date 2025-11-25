"use client"

import React, { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "./toast/use-toast";
import { getGoogleAuthUrl } from "@/lib/auth/google";
import { logger } from "@/lib/utils/logger";

/**
 * Google Logo SVG - better quality than favicon
 */
function GoogleLogo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleButton() {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [publicEnv, setPublicEnv] = useState<Record<string, string>>({});
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error("Failed to fetch config");
        const data = await res.json();
        setPublicEnv(data);
      } catch (err) {
        console.error("Failed to load public env config:", err);
      }
    };

    fetchConfig();
  }, []);

  const handleGoogleSignIn = () => {
    if (!publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      return;
    }

    try {
      const authUrl = getGoogleAuthUrl(publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID, publicEnv.NEXT_PUBLIC_GOOGLE_REDIRECT_URI);

      // Open popup window
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        "Google Sign In",
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      // Listen for messages from popup
      const messageHandler = async (event: MessageEvent) => {
        if (event.data?.type === 'google-auth') {
          window.removeEventListener('message', messageHandler);
          if (popup) popup.close();

          if (event.data.error) {
            toast({
              title: "Error",
              description: "Failed to sign in with Google. Please try again.",
              variant: "destructive",
            });
            return;
          }

          // Set the session cookie
          const expires = new Date();
          expires.setDate(expires.getDate() + 7);
          document.cookie = `session=${event.data.jwt}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

          // Handle any pending actions
          const pendingArtifactHubUrl = sessionStorage.getItem('pendingArtifactHubUrl');
          const pendingPrompt = sessionStorage.getItem('pendingPrompt');

          if (pendingArtifactHubUrl) {
            sessionStorage.removeItem('pendingArtifactHubUrl');
            window.location.href = `/artifacthub.io/packages/helm/${encodeURIComponent(pendingArtifactHubUrl)}`;
          } else if (pendingPrompt) {
            sessionStorage.removeItem('pendingPrompt');
            window.location.href = `/workspace/new?prompt=${encodeURIComponent(pendingPrompt)}`;
          } else {
            window.location.href = '/';
          }
        }
      };

      window.addEventListener('message', messageHandler);
    } catch (error) {
      logger.error("Failed to initiate Google login", { error });
      toast({
        title: "Error",
        description: "Failed to initiate Google login. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative group flex items-center justify-center gap-3 w-full
        rounded-forge px-5 py-3.5
        font-display font-semibold text-sm
        transition-all duration-200 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-forge-ember focus-visible:ring-offset-2
        active:scale-[0.98]
        ${theme === "dark"
          ? "bg-forge-iron/50 text-stone-100 border border-forge-zinc hover:bg-forge-zinc hover:border-forge-ember/30"
          : "bg-white text-stone-700 border border-stone-300 hover:border-stone-400 hover:shadow-md"
        }
        ${theme === "dark" ? "focus-visible:ring-offset-forge-steel" : "focus-visible:ring-offset-white"}
      `}
    >
      {/* Subtle glow on hover (dark mode) */}
      {theme === "dark" && (
        <div className={`
          absolute inset-0 rounded-forge opacity-0 group-hover:opacity-100
          transition-opacity duration-300 pointer-events-none
          shadow-ember-sm
        `} />
      )}

      <GoogleLogo className="w-5 h-5 flex-shrink-0" />

      <span className="relative">
        Continue with Google
      </span>

      {/* Arrow indicator on hover */}
      <svg
        className={`
          w-4 h-4 transition-all duration-200
          ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}
          ${theme === "dark" ? "text-forge-ember" : "text-stone-500"}
        `}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
