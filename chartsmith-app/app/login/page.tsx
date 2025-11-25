"use client";

import React from "react";
import { GoogleButton } from "@/components/GoogleButton";
import { useTheme } from "@/contexts/ThemeContext";
import { validateTestAuth } from "@/lib/auth/actions/test-auth";
import Link from "next/link";
import { Flame, Sparkles, ArrowRight } from "lucide-react";

/**
 * Animated spark particles for the forge effect
 */
function SparkParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Static sparks at different positions */}
      <div className="absolute top-1/4 left-1/4 w-1 h-1 rounded-full bg-forge-ember animate-pulse opacity-60" style={{ animationDelay: '0s' }} />
      <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 rounded-full bg-forge-ember-bright animate-pulse opacity-40" style={{ animationDelay: '0.5s' }} />
      <div className="absolute bottom-1/4 left-1/3 w-0.5 h-0.5 rounded-full bg-forge-heat-yellow animate-pulse opacity-50" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 right-1/4 w-1 h-1 rounded-full bg-forge-ember animate-pulse opacity-30" style={{ animationDelay: '1.5s' }} />
      <div className="absolute bottom-1/3 right-1/2 w-0.5 h-0.5 rounded-full bg-forge-ember-glow animate-pulse opacity-60" style={{ animationDelay: '2s' }} />
    </div>
  );
}

/**
 * Large decorative forge logo for the login page
 */
function ForgeHeroLogo() {
  return (
    <div className="relative">
      {/* Glow effect behind */}
      <div className="absolute inset-0 blur-3xl bg-forge-ember/20 rounded-full scale-150" />

      <svg
        width="120"
        height="120"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        {/* Background - dark steel plate */}
        <rect width="32" height="32" rx="6" fill="#18181b" />

        {/* Ember glow behind the anvil */}
        <ellipse cx="16" cy="24" rx="10" ry="3" fill="#f97316" fillOpacity="0.4" />

        {/* Anvil body */}
        <path
          d="M8 18L10 14H22L24 18L22 20H10L8 18Z"
          fill="url(#steelGradientHero)"
          stroke="#3f3f46"
          strokeWidth="0.5"
        />

        {/* Anvil base */}
        <path
          d="M11 20H21V24C21 25.1046 20.1046 26 19 26H13C11.8954 26 11 25.1046 11 24V20Z"
          fill="#27272a"
          stroke="#3f3f46"
          strokeWidth="0.5"
        />

        {/* Hammer */}
        <path
          d="M14 6L18 6L18 12L14 12L14 6Z"
          fill="url(#emberGradientHero)"
          stroke="#ea580c"
          strokeWidth="0.5"
        />

        {/* Hammer head */}
        <rect x="12" y="4" width="8" height="4" rx="1" fill="#f97316" />

        {/* Spark effects */}
        <circle cx="20" cy="10" r="1" fill="#fbbf24" />
        <circle cx="22" cy="8" r="0.5" fill="#f97316" />
        <circle cx="10" cy="9" r="0.75" fill="#fb923c" />
        <circle cx="8" cy="11" r="0.5" fill="#fbbf24" />
        <circle cx="24" cy="11" r="0.5" fill="#fb923c" />

        <defs>
          <linearGradient id="steelGradientHero" x1="8" y1="14" x2="24" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="#52525b" />
            <stop offset="0.5" stopColor="#3f3f46" />
            <stop offset="1" stopColor="#27272a" />
          </linearGradient>
          <linearGradient id="emberGradientHero" x1="14" y1="6" x2="18" y2="12" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fbbf24" />
            <stop offset="0.5" stopColor="#f97316" />
            <stop offset="1" stopColor="#ea580c" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const { theme } = useTheme();

  const [publicEnv, setPublicEnv] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (!publicEnv.NEXT_PUBLIC_ENABLE_TEST_AUTH) {
      return;
    }

    // Only run in development/test environment
    if (process.env.NODE_ENV !== 'production' &&
        publicEnv.NEXT_PUBLIC_ENABLE_TEST_AUTH === 'true') {
      // Check for test auth parameter
      const params = new URLSearchParams(window.location.search);
      if (params.get('test-auth') === 'true') {
        validateTestAuth().then((jwt) => {
          if (jwt) {
            const expires = new Date();
            expires.setDate(expires.getDate() + 7);
            document.cookie = `session=${jwt}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
            window.location.href = '/';
          }
        });
      }
    }
  }, [publicEnv.NEXT_PUBLIC_ENABLE_TEST_AUTH]);

  return (
    <div className={`
      min-h-screen relative overflow-hidden
      ${theme === "dark" ? "bg-forge-black" : "bg-stone-50"}
    `}>
      {/* Background grid pattern */}
      <div className={`
        absolute inset-0 pattern-grid opacity-30
        ${theme === "dark" ? "" : "opacity-20"}
      `} />

      {/* Gradient overlay */}
      <div className={`
        absolute inset-0
        ${theme === "dark"
          ? "bg-gradient-to-br from-forge-black via-forge-charcoal to-forge-black"
          : "bg-gradient-to-br from-stone-50 via-stone-100 to-stone-50"
        }
      `} />

      {/* Animated sparks (dark mode only) */}
      {theme === "dark" && <SparkParticles />}

      {/* Ember glow at bottom */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 blur-[100px] bg-gradient-to-t from-forge-ember via-forge-ember/50 to-transparent rounded-full" />
      </div>

      <main className="relative z-10 container mx-auto flex flex-col items-center justify-center px-6 min-h-screen py-12">
        <div className="w-full max-w-md animate-slideUp">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <ForgeHeroLogo />
          </div>

          {/* Brand Text */}
          <div className="text-center mb-10">
            <h1 className={`
              font-display text-display-md font-bold tracking-tight mb-3
              ${theme === "dark" ? "text-stone-100" : "text-stone-900"}
            `}>
              Welcome to the{" "}
              <span className="text-gradient-ember">Forge</span>
            </h1>
            <p className={`
              text-body-lg
              ${theme === "dark" ? "text-forge-silver" : "text-stone-500"}
            `}>
              Craft production-ready Helm charts with AI precision
            </p>
          </div>

          {/* Login Card */}
          <div className={`
            relative rounded-forge-lg overflow-hidden
            ${theme === "dark"
              ? "bg-forge-steel/50 border border-forge-iron"
              : "bg-white border border-stone-200 shadow-lg"
            }
          `}>
            {/* Subtle top border gradient */}
            <div className="absolute top-0 left-0 right-0 h-[2px] gradient-border" />

            <div className="p-8">
              {/* Features list */}
              <div className="mb-8 space-y-3">
                {[
                  "AI-powered chart generation",
                  "Real-time validation & linting",
                  "Best practices built-in"
                ].map((feature, i) => (
                  <div
                    key={i}
                    className={`
                      flex items-center gap-3 text-sm
                      ${theme === "dark" ? "text-forge-silver" : "text-stone-600"}
                    `}
                  >
                    <Sparkles className="w-4 h-4 text-forge-ember flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className={`
                flex items-center gap-4 mb-6
                ${theme === "dark" ? "text-forge-zinc" : "text-stone-400"}
              `}>
                <div className="flex-1 h-px bg-current opacity-30" />
                <span className="text-xs font-medium uppercase tracking-wider">Sign in to continue</span>
                <div className="flex-1 h-px bg-current opacity-30" />
              </div>

              {/* Google Button */}
              <GoogleButton />

              {/* Terms */}
              <p className={`
                mt-6 text-xs text-center leading-relaxed
                ${theme === "dark" ? "text-forge-zinc" : "text-stone-400"}
              `}>
                By signing in, you agree to our{" "}
                <Link href="/terms" className="text-forge-ember hover:text-forge-ember-bright transition-colors">
                  Terms of Service
                </Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-forge-ember hover:text-forge-ember-bright transition-colors">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-8 text-center">
            <p className={`
              text-sm
              ${theme === "dark" ? "text-forge-zinc" : "text-stone-500"}
            `}>
              New to ChartSmith?{" "}
              <Link
                href="/signup"
                className="inline-flex items-center gap-1 font-semibold text-forge-ember hover:text-forge-ember-bright transition-colors group"
              >
                Get started free
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </p>
          </div>

          {/* Tagline */}
          <div className="mt-12 text-center">
            <p className={`
              text-overline uppercase tracking-widest
              ${theme === "dark" ? "text-forge-zinc/60" : "text-stone-400/60"}
            `}>
              Powered by Replicated
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
