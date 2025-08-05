
'use client';

import React, { useRef, useEffect } from 'react';
import type { ImageEvaluationResult } from '@/lib/types';

interface AnnotationViewerProps {
  imageUrl: string;
  imageResult: ImageEvaluationResult;
}

export function AnnotationViewer({ imageUrl, imageResult }: AnnotationViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const image = new Image();
    image.src = imageUrl;
    image.onload = () => {
      // Scale canvas to fit image, maintaining aspect ratio
      const maxWidth = canvas.parentElement?.clientWidth || 800;
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      canvas.width = image.naturalWidth * scale;
      canvas.height = image.naturalHeight * scale;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const drawBbox = (bbox: number[], color: string, label?: string) => {
        const [x, y, w, h] = bbox.map(coord => coord * scale);
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.strokeRect(x, y, w, h);
        if (label) {
            context.fillStyle = color;
            context.font = '12px Arial';
            context.fillText(label, x, y > 10 ? y - 2 : y + 10);
        }
      };
      
      const allStudentAnns = new Set(imageResult.matched.map(m => m.student.id).concat(imageResult.extra.map(e => e.student.id)));
      
      // Draw GT boxes
      imageResult.missed.forEach(m => drawBbox(m.gt.bbox, 'rgba(255, 0, 0, 0.7)', `Missed: ${m.gt.attributes?.['label'] || m.gt.id}`)); // Red for missed
      imageResult.matched.forEach(m => drawBbox(m.gt.bbox, 'rgba(0, 255, 0, 0.7)')); // Green for correct GT
      
      // Draw Student boxes
      imageResult.extra.forEach(e => drawBbox(e.student.bbox, 'rgba(255, 165, 0, 0.7)', `Extra: ${e.student.attributes?.['label'] || e.student.id}`)); // Orange for extra
      imageResult.matched.forEach(m => drawBbox(m.student.bbox, 'rgba(0, 0, 255, 0.5)')); // Blue for student match

    };
    
    return () => {
        // Cleanup object URL
        URL.revokeObjectURL(imageUrl);
    }

  }, [imageUrl, imageResult]);

  return <canvas ref={canvasRef} className="w-full h-auto rounded-md border" />;
}
