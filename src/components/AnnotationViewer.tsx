
'use client';

import React from 'react';
import type { ImageEvaluationResult } from '@/lib/types';

interface AnnotationViewerProps {
  imageUrl: string;
  imageResult: ImageEvaluationResult;
}

export function AnnotationViewer({ imageUrl, imageResult }: AnnotationViewerProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
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

      const drawBbox = (bbox: number[], color: string, label?: string, textPosition?: 'top' | 'bottom') => {
        const [x, y, w, h] = bbox.map(coord => coord * scale);
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.strokeRect(x, y, w, h);
        
        if (label) {
            context.fillStyle = color;
            context.font = 'bold 14px Arial';
            const textWidth = context.measureText(label).width;
            
            let textX = x;
            let textY = textPosition === 'bottom' ? y + h + 15 : y - 5;
            
            // Adjust to keep text within canvas bounds
            if (textY < 15) textY = y + 15;
            if (textY > canvas.height - 5) textY = y + h - 5;
            if (textX + textWidth > canvas.width) textX = canvas.width - textWidth - 5;
            if (textX < 0) textX = 5;

            context.fillText(label, textX, textY);
        }
      };
      
      imageResult.missed.forEach(m => drawBbox(m.gt.bbox, 'rgba(255, 0, 0, 0.9)', `Missed: ${m.gt.attributes?.['label'] || m.gt.id}`, 'top')); // Red for missed
      
      imageResult.extra.forEach(e => drawBbox(e.student.bbox, 'rgba(255, 165, 0, 0.9)', `Extra: ${e.student.attributes?.['label'] || e.student.id}`, 'bottom')); // Orange for extra
      
      imageResult.matched.forEach(m => {
        // Draw GT box in green
        drawBbox(m.gt.bbox, 'rgba(0, 255, 0, 0.7)'); 

        // Draw student box in blue, slightly offset to see both
        const studentBbox = [...m.student.bbox];
        studentBbox[0] += 2;
        studentBbox[1] += 2;
        drawBbox(studentBbox, 'rgba(0, 0, 255, 0.7)');
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
            context.fillText('Error loading image. URL might be invalid.', canvas.width / 2, canvas.height / 2);
        }
    }

  }, [imageUrl, imageResult]);

  return <canvas ref={canvasRef} className="w-full h-auto rounded-md border bg-muted" />;
}
