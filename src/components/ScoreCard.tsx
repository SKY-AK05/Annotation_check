'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ScoreCardProps {
  score: number;
  className?: string;
}

export function ScoreCard({ score, className }: ScoreCardProps) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = React.useState(circumference);

  React.useEffect(() => {
    const progressOffset = circumference - (score / 100) * circumference;
    setOffset(progressOffset);
  }, [score, circumference]);
  
  const scoreColor = score > 80 ? "text-green-500" : score > 60 ? "text-yellow-500" : "text-red-500";

  return (
    <div className={cn("relative flex items-center justify-center w-48 h-48", className)}>
      <svg className="w-full h-full transform -rotate-90">
        <circle
          className="text-primary/10"
          strokeWidth="12"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="96"
          cy="96"
        />
        <circle
          className="text-primary"
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="96"
          cy="96"
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn("text-4xl font-bold", scoreColor)}>
          {score}
        </span>
        <span className="text-sm font-medium text-muted-foreground">Score</span>
      </div>
    </div>
  );
}
