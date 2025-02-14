"use client";

import React from "react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto p-6">
      <div className="flex justify-end gap-6 text-sm text-gray-500">
        <Link href="/terms" className="hover:text-gray-300 transition-colors">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-gray-300 transition-colors">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
