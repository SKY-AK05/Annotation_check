import * as React from 'react';

export const AnnotatorAiLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Rough box shape */}
    <path d="M20 25 C15 20, 85 20, 80 25 C85 30, 15 30, 20 25 Z" transform="rotate(-2)" />
    <path d="M20 25 L18 80 C13 85, 87 85, 82 80 L 80 25" transform="rotate(-2)" />
    <path d="M18 80 C13 85, 87 85, 82 80" transform="rotate(-2)" />

    {/* Simple 'A' inside */}
    <path d="M40 70 L50 40 L60 70" />
    <path d="M45 60 L55 60" />

  </svg>
);
