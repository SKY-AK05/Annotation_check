
'use client';

import React, { useRef, useEffect } from 'react';
import type { Polygon, PolygonAnnotation, PolygonMatch } from '@/lib/types';

interface PolygonViewerProps {
  imageUrl: string;
  annotations: {
    matched: PolygonMatch[];
    missed: { gt: PolygonAnnotation }[];
    extra: { student: PolygonAnnotation }[];
  };
}

const GT_COLOR = 'rgba(0, 215, 255, 1)'; // Cyan for GT Outline
const STUDENT_COLOR = 'rgba(255, 0, 0, 1)'; // Red for Student Outline
const MISSED_FILL = 'rgba(0, 215, 255, 0.5)'; // Semi-transparent Cyan for missed
const EXTRA_FILL = 'rgba(255, 0, 0, 0.5)'; // Semi-transparent Red for extra


export function PolygonViewer({ imageUrl, annotations }: PolygonViewerProps) {
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
      
      const drawPolygon = (polygonPoints: Polygon[], color: string, isFill: boolean = false, lineWidth: number = 2) => {
        if (!polygonPoints || polygonPoints.length === 0) return;
        
        const polygon = polygonPoints[0];
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
            context.lineWidth = lineWidth;
            context.stroke();
        }
      };

      // Draw missed polygons (filled GT)
      annotations.missed.forEach(miss => {
         drawPolygon(miss.gt.segmentation, MISSED_FILL, true);
      });

      // Draw extra polygons (filled student)
      annotations.extra.forEach(extra => {
        drawPolygon(extra.student.segmentation, EXTRA_FILL, true);
      });

      // Draw matched polygons (outlines)
      annotations.matched.forEach(match => {
        drawPolygon(match.gt.segmentation, GT_COLOR);
        drawPolygon(match.student.segmentation, STUDENT_COLOR);
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

  }, [imageUrl, annotations]);

  return <canvas ref={canvasRef} className="w-full h-auto rounded-md border bg-muted" />;
}
