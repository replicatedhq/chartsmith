"use client";
import React from "react";
import { Flame, Sparkles } from "lucide-react";

export function HomeHeader() {
  return (
    <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12 lg:mb-20">
      {/* Decorative badge */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-forge-ember/10 border border-forge-ember/20 mb-6 sm:mb-8">
        <Flame className="w-4 h-4 text-forge-ember" />
        <span className="text-sm font-medium text-forge-ember-bright">
          AI-Powered Helm Chart Forge
        </span>
        <Sparkles className="w-4 h-4 text-forge-ember" />
      </div>

      {/* Main heading with forge gradient */}
      <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 tracking-tight">
        <span className="text-stone-100">Welcome to the </span>
        <span className="text-gradient-ember">Forge</span>
      </h1>

      {/* Subheading */}
      <p className="text-forge-silver text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
        Craft production-ready Helm charts with AI precision.
        <span className="text-stone-300 block mt-2">
          Create, modify, and validate—all in one place.
        </span>
      </p>

      {/* Decorative ember line */}
      <div className="flex items-center justify-center gap-3 mt-8">
        <div className="w-12 h-px bg-gradient-to-r from-transparent to-forge-ember/50" />
        <div className="w-2 h-2 rounded-full bg-forge-ember ember-pulse" />
        <div className="w-12 h-px bg-gradient-to-l from-transparent to-forge-ember/50" />
      </div>
    </div>
  );
}
