import * as React from 'react';

export const AnnotatorAiLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M7 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
    <path d="M5 19V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" strokeDasharray="4" strokeDashoffset="4"/>
    <circle cx="12" cy="12" r=".5" fill="currentColor" />
    <path d="M12 12L7 7" />
    <path d="M12 12l5 5" />
  </svg>
);
