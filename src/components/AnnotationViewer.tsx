
'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { ImageEvaluationResult } from '@/lib/types';
import { Button } from './ui/button';
import { ZoomIn, ZoomOut, RefreshCcw } from 'lucide-react';

interface AnnotationViewerProps {
  imageUrl: string;
  imageResult: ImageEvaluationResult;
}

export function AnnotationViewer({ imageUrl, imageResult }: AnnotationViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scale, setScale] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement | null>(null);
    const baseScale = useRef(1);

    const draw = () => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        const image = imageRef.current;

        if (!canvas || !context || !image || image.naturalWidth === 0) return;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.save();
        context.translate(panOffset.x, panOffset.y);
        context.scale(scale, scale);
        context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);

        const drawBbox = (bbox: number[], color: string, label?: string, textPosition?: 'top' | 'bottom') => {
            const [x, y, w, h] = bbox;
            context.strokeStyle = color;
            context.lineWidth = 2 / scale; // Keep line width consistent when zooming
            context.strokeRect(x, y, w, h);
            
            if (label) {
                context.fillStyle = color;
                const fontSize = 14 / scale;
                context.font = `bold ${fontSize}px Arial`;
                
                let textX = x;
                let textY = textPosition === 'bottom' ? y + h + (15 / scale) : y - (5 / scale);
                
                context.fillText(label, textX, textY);
            }
        };
        
        imageResult.missed.forEach(m => drawBbox(m.gt.bbox, 'rgba(255, 0, 0, 0.9)', `Missed: ${m.gt.attributes?.['label'] || m.gt.id}`, 'top'));
        imageResult.extra.forEach(e => drawBbox(e.student.bbox, 'rgba(255, 165, 0, 0.9)', `Extra: ${e.student.attributes?.['label'] || e.student.id}`, 'bottom'));
        imageResult.matched.forEach(m => {
            drawBbox(m.gt.bbox, 'rgba(0, 255, 0, 0.7)');
            const studentBbox = [...m.student.bbox];
            studentBbox[0] += 2 / scale;
            studentBbox[1] += 2 / scale;
            drawBbox(studentBbox, 'rgba(0, 0, 255, 0.7)');
        });

        context.restore();
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
        imageRef.current = img;

        const handleLoad = () => {
            if (!canvasRef.current) return;
            const parentWidth = canvasRef.current.parentElement?.clientWidth || 800;
            const newBaseScale = Math.min(1, parentWidth / img.naturalWidth);
            baseScale.current = newBaseScale;
            canvasRef.current.width = parentWidth;
            canvasRef.current.height = (img.naturalHeight * parentWidth) / img.naturalWidth;
            setPanOffset({ x: 0, y: 0 });
            setScale(newBaseScale);
        };
        
        img.onload = handleLoad;

        return () => {
            img.onload = null;
        };
    }, [imageUrl]);

    useEffect(() => {
        draw();
    }, [scale, panOffset, imageResult, imageUrl]);

    const handleZoom = (direction: 'in' | 'out') => {
        const zoomFactor = 1.2;
        const newScale = direction === 'in' ? scale * zoomFactor : scale / zoomFactor;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const worldX = (centerX - panOffset.x) / scale;
        const worldY = (centerY - panOffset.y) / scale;

        setPanOffset({
            x: centerX - worldX * newScale,
            y: centerY - worldY * newScale
        });

        setScale(Math.max(0.1, Math.min(newScale, 20)));
    };
    
    const resetView = () => {
        setPanOffset({ x: 0, y: 0 });
        setScale(baseScale.current);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsPanning(true);
        setLastPanPoint({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isPanning) return;
        const dx = e.clientX - lastPanPoint.x;
        const dy = e.clientY - lastPanPoint.y;
        setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastPanPoint({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };
    
    return (
        <div className="relative w-full">
            <canvas 
                ref={canvasRef} 
                className="w-full h-auto rounded-md border bg-muted cursor-grab" 
                style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
                 <Button variant="outline" size="icon" onClick={() => handleZoom('in')} title="Zoom In">
                    <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleZoom('out')} title="Zoom Out">
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={resetView} title="Reset View">
                    <RefreshCcw className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
