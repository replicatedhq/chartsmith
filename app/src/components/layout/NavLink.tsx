import React from 'react';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  return (
    <a
      href={href}
      className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors"
    >
      {children}
    </a>
  );
}