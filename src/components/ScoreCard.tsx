
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
  const scoreValue = Math.round(score);

  React.useEffect(() => {
    // Clamp score between 0 and 100
    const clampedScore = Math.max(0, Math.min(scoreValue, 100));
    const progressOffset = circumference - (clampedScore / 100) * circumference;
    setOffset(progressOffset);
  }, [scoreValue, circumference]);
  
  const scoreColor = scoreValue > 80 ? "text-green-500" : scoreValue > 60 ? "text-yellow-500" : "text-red-500";

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
          className={scoreColor}
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
          {scoreValue}
        </span>
        <span className="text-sm font-medium text-muted-foreground">Score</span>
      </div>
    </div>
  );
}
