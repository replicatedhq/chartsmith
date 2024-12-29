import React from "react";
import { Twitter, Github } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-[#0D1117] border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-end">
        <div className="flex items-center space-x-6">
          <a href="https://twitter.com/replicatedhq" className="text-gray-400 hover:text-gray-300">
            <Twitter className="w-5 h-5" />
          </a>
          <a href="https://github.com/replicatedhq" className="text-gray-400 hover:text-gray-300">
            <Github className="w-5 h-5" />
          </a>
          <span className="text-gray-600">•</span>
          <Link href="/terms" className="text-gray-400 hover:text-gray-300">
            Terms
          </Link>
          <Link href="/privacy" className="text-gray-400 hover:text-gray-300">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
