
'use client';

import React, { useRef, useEffect } from 'react';
import type { CocoJson, SkeletonEvaluationResult } from '@/lib/types';

interface SkeletonViewerProps {
  imageUrl: string;
  gtJson: CocoJson;
  studentJson: CocoJson;
  results: SkeletonEvaluationResult;
}

const GT_COLOR = 'rgba(0, 255, 0, 0.9)'; // Green
const STUDENT_COLOR = 'rgba(0, 0, 255, 0.9)'; // Blue
const MISSED_COLOR = 'rgba(255, 0, 0, 0.7)'; // Red
const EXTRA_COLOR = 'rgba(255, 165, 0, 0.7)'; // Orange

export function SkeletonViewer({ imageUrl, gtJson, studentJson, results }: SkeletonViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageUrl;

    image.onload = () => {
      const maxWidth = canvas.parentElement?.clientWidth || 800;
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      canvas.width = image.naturalWidth * scale;
      canvas.height = image.naturalHeight * scale;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      const skeletonTemplate = gtJson.categories[0]?.skeleton;
      if (!skeletonTemplate) return;

      const drawSkeleton = (keypoints: number[], color: string) => {
        context.fillStyle = color;
        context.strokeStyle = color;
        context.lineWidth = 2 * scale;

        // Draw keypoints
        for (let i = 0; i < keypoints.length; i += 3) {
          if (keypoints[i + 2] > 0) { // If visible
            const x = keypoints[i] * scale;
            const y = keypoints[i + 1] * scale;
            context.beginPath();
            context.arc(x, y, 4 * scale, 0, 2 * Math.PI);
            context.fill();
          }
        }

        // Draw limbs
        for (const limb of skeletonTemplate) {
          const [p1Index, p2Index] = limb;
          const i1 = (p1Index - 1) * 3;
          const i2 = (p2Index - 1) * 3;

          if (keypoints[i1 + 2] > 0 && keypoints[i2 + 2] > 0) {
            const x1 = keypoints[i1] * scale;
            const y1 = keypoints[i1 + 1] * scale;
            const x2 = keypoints[i2] * scale;
            const y2 = keypoints[i2 + 1] * scale;

            context.beginPath();
            context.moveTo(x1, y1);
            context.lineTo(x2, y2);
            context.stroke();
          }
        }
      };

      const drawBbox = (bbox: number[], color: string) => {
        const [x, y, w, h] = bbox.map(coord => coord * scale);
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.strokeRect(x, y, w, h);
      };

      // Draw matched skeletons
      results.matched.forEach(match => {
        if (match.gt.keypoints) {
          drawSkeleton(match.gt.keypoints, GT_COLOR);
        }
        if (match.student.keypoints) {
          drawSkeleton(match.student.keypoints, STUDENT_COLOR);
        }
      });
      
      // Draw missed skeletons
      results.missed.forEach(miss => {
         drawBbox(miss.gt.bbox, MISSED_COLOR);
         if (miss.gt.keypoints) {
            drawSkeleton(miss.gt.keypoints, MISSED_COLOR);
         }
      });

      // Draw extra skeletons
      results.extra.forEach(extra => {
        drawBbox(extra.student.bbox, EXTRA_COLOR);
         if (extra.student.keypoints) {
            drawSkeleton(extra.student.keypoints, EXTRA_COLOR);
         }
      });

    };
    
    image.onerror = () => {
        if(context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = '#f0f0f0';
            context.fillRect(0,0, canvas.width, canvas.height);
            context.fillStyle = '#888';
            context.font = '16px Arial';
            context.textAlign = 'center';
            context.fillText('Error loading image.', canvas.width / 2, canvas.height / 2);
        }
    }

  }, [imageUrl, gtJson, studentJson, results]);

  return <canvas ref={canvasRef} className="w-full h-auto rounded-md border bg-muted" />;
}
