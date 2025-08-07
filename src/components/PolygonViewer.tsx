
'use client';

import React, { useRef, useEffect } from 'react';
import type { Polygon, PolygonEvaluationResult } from '@/lib/types';

interface PolygonViewerProps {
  imageUrl: string;
  results: PolygonEvaluationResult;
}

const GT_COLOR = 'rgba(0, 215, 255, 1)'; // Gold
const STUDENT_COLOR = 'rgba(255, 0, 0, 1)'; // Red

export function PolygonViewer({ imageUrl, results }: PolygonViewerProps) {
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
      
      const drawPolygon = (polygon: Polygon, color: string, isFill: boolean = false) => {
        if (polygon.length < 2) return;
        
        context.beginPath();
        context.moveTo(polygon[0][0] * scale, polygon[0][1] * scale);
        for (let i = 1; i < polygon.length; i++) {
            context.lineTo(polygon[i][0] * scale, polygon[i][1] * scale);
        }
        context.closePath();
        
        if(isFill) {
            context.fillStyle = color;
            context.fill();
        } else {
            context.strokeStyle = color;
            context.lineWidth = 2;
            context.stroke();
        }
      };

      // Draw matched polygons
      results.matched.forEach(match => {
        drawPolygon(match.gt.segmentation[0], GT_COLOR);
        drawPolygon(match.student.segmentation[0], STUDENT_COLOR);
      });
      
      // Draw missed polygons
      results.missed.forEach(miss => {
         drawPolygon(miss.gt.segmentation[0], GT_COLOR, true);
      });

      // Draw extra polygons
      results.extra.forEach(extra => {
        drawPolygon(extra.student.segmentation[0], STUDENT_COLOR, true);
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

  }, [imageUrl, results]);

  return <canvas ref={canvasRef} className="w-full h-auto rounded-md border bg-muted" />;
}
