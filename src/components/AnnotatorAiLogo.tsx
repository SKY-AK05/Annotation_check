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
    <path d="M25 35 C20 30, 80 30, 75 35 C80 40, 20 40, 25 35 Z" />
    <path d="M25 35 L25 75 C20 80, 80 80, 75 75 L75 35" />
    <path d="M24 76 C19 81, 81 81, 76 76" />
    
    <path d="M40 50 L60 65" />
    <path d="M60 50 L40 65" />
    
    <circle cx="50" cy="58" r="3" fill="currentColor"/>
  </svg>
);
