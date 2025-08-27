
'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { ImageEvaluationResult, BboxAnnotation, SelectedAnnotation, Match, Feedback } from '@/lib/types';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { ZoomIn, ZoomOut, RefreshCcw } from 'lucide-react';

interface AnnotationViewerProps {
  imageUrl: string;
  imageResult: ImageEvaluationResult;
  selectedAnnotation: SelectedAnnotation | null;
  feedback: Feedback | null;
  onAnnotationSelect: (annotation: SelectedAnnotation | null) => void;
}

export function AnnotationViewer({ imageUrl, imageResult, selectedAnnotation, feedback, onAnnotationSelect }: AnnotationViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scale, setScale] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setPanning] = useState(false);
    const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement | null>(null);
    const baseScale = useRef(1);
    
    const [visibility, setVisibility] = useState({
      gt: true,
      student: true,
      missed: true,
      extra: true,
    });

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

        const drawBbox = (bbox: number[], color: string, lineWidth: number = 2) => {
            const [x, y, w, h] = bbox;
            context.strokeStyle = color;
            context.lineWidth = lineWidth / scale; // Keep line width consistent when zooming
            context.strokeRect(x, y, w, h);
        };
        
        const drawOverlay = (bbox: number[], color: string) => {
            const [x, y, w, h] = bbox;
            context.fillStyle = color;
            context.fillRect(x, y, w, h);
        };

        if (selectedAnnotation && selectedAnnotation.imageId === imageResult.imageId) {
            let itemToDraw: Match | undefined;
            if (selectedAnnotation.type === 'match') {
                itemToDraw = imageResult.matched.find(m => m.gt.id === selectedAnnotation.annotationId);
            }

            if (itemToDraw) {
                // Draw GT and Student boxes with higher visibility
                drawBbox(itemToDraw.gt.bbox, 'rgba(0, 255, 0, 1)', 4); // Green for GT
                drawBbox(itemToDraw.student.bbox, 'rgba(255, 0, 0, 1)', 4); // Red for Student

                // If feedback is available for this annotation, draw it
                if (feedback && feedback.annotationId === selectedAnnotation.annotationId) {
                    const [gtX, gtY, gtW, gtH] = itemToDraw.gt.bbox;
                    const [stX, stY, stW, stH] = itemToDraw.student.bbox;
                    const gtRight = gtX + gtW;
                    const gtBottom = gtY + gtH;
                    const stRight = stX + stW;
                    const stBottom = stY + stH;

                    feedback.issues.forEach(issue => {
                        // Cut off (Student box is larger than GT): Show red overlay on the area outside GT
                        if (issue.status === 'cut_off') {
                            if (issue.edge === 'top' && stY < gtY) drawOverlay([stX, stY, stW, gtY - stY], 'rgba(255,0,0,0.4)');
                            if (issue.edge === 'bottom' && stBottom > gtBottom) drawOverlay([stX, gtBottom, stW, stBottom - gtBottom], 'rgba(255,0,0,0.4)');
                            if (issue.edge === 'left' && stX < gtX) drawOverlay([stX, stY, gtX - stX, stH], 'rgba(255,0,0,0.4)');
                            if (issue.edge === 'right' && stRight > gtRight) drawOverlay([gtRight, stY, stRight - gtRight, stH], 'rgba(255,0,0,0.4)');
                        }
                        // Gap (Student box is smaller than GT): Show blue overlay on the missed area
                        else if (issue.status === 'gap') {
                            if (issue.edge === 'top' && stY > gtY) drawOverlay([gtX, gtY, gtW, stY - gtY], 'rgba(0,0,255,0.4)');
                            if (issue.edge === 'bottom' && stBottom < gtBottom) drawOverlay([gtX, stBottom, gtW, gtBottom - stBottom], 'rgba(0,0,255,0.4)');
                            if (issue.edge === 'left' && stX > gtX) drawOverlay([gtX, gtY, stX - gtX, gtH], 'rgba(0,0,255,0.4)');
                            if (issue.edge === 'right' && stRight < gtRight) drawOverlay([stRight, gtY, gtRight - stRight, gtH], 'rgba(0,0,255,0.4)');
                        }
                    });
                }
            } else {
                // Handle drawing for selected missed/extra annotations if needed
                const missed = imageResult.missed.find(m => selectedAnnotation.type === 'missed' && m.gt.id === selectedAnnotation.annotationId);
                if (missed) drawBbox(missed.gt.bbox, 'rgba(255, 0, 0, 0.9)', 4);
                
                const extra = imageResult.extra.find(e => selectedAnnotation.type === 'extra' && e.student.id === selectedAnnotation.annotationId);
                if (extra) drawBbox(extra.student.bbox, 'rgba(255, 165, 0, 0.9)', 4);
            }
        } else {
            // Default view: draw all annotations based on visibility
            if (visibility.missed) {
                imageResult.missed.forEach(m => drawBbox(m.gt.bbox, 'rgba(255, 0, 0, 0.9)'));
            }
            
            if (visibility.extra) {
                imageResult.extra.forEach(e => drawBbox(e.student.bbox, 'rgba(255, 165, 0, 0.9)'));
            }

            imageResult.matched.forEach(m => {
                if (visibility.gt) drawBbox(m.gt.bbox, 'rgba(0, 255, 0, 0.7)');
                if (visibility.student) drawBbox(m.student.bbox, 'rgba(0, 0, 255, 0.7)');
            });
        }
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
    }, [scale, panOffset, imageResult, imageUrl, visibility, selectedAnnotation, feedback]);

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
        setPanning(true);
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
        setPanning(false);
    };

    const handleVisibilityChange = (key: keyof typeof visibility, checked: boolean) => {
        setVisibility(prev => ({ ...prev, [key]: checked }));
    };
    
    const Legend = () => (
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground mt-2 border-t pt-2">
          <div className="flex items-center gap-2">
              <Checkbox id="gt-check" checked={visibility.gt} onCheckedChange={(checked) => handleVisibilityChange('gt', !!checked)} />
              <Label htmlFor='gt-check' className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm" style={{ border: '2px solid rgba(0, 255, 0, 1)' }}></div>GT (Matched)</Label>
          </div>
          <div className="flex items-center gap-2">
              <Checkbox id="student-check" checked={visibility.student} onCheckedChange={(checked) => handleVisibilityChange('student', !!checked)} />
              <Label htmlFor='student-check' className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm" style={{ border: '2px solid rgba(0, 0, 255, 0.7)' }}></div>Student (Matched)</Label>
          </div>
           <div className="flex items-center gap-2">
              <Checkbox id="missed-check" checked={visibility.missed} onCheckedChange={(checked) => handleVisibilityChange('missed', !!checked)} />
              <Label htmlFor='missed-check' className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'rgba(255, 0, 0, 0.9)' }}></div>Missed</Label>
          </div>
           <div className="flex items-center gap-2">
              <Checkbox id="extra-check" checked={visibility.extra} onCheckedChange={(checked) => handleVisibilityChange('extra', !!checked)} />
              <Label htmlFor='extra-check' className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'rgba(255, 165, 0, 0.9)' }}></div>Extra</Label>
          </div>
      </div>
    );
    
    return (
        <div className="w-full">
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
            { !selectedAnnotation && <Legend /> }
        </div>
    );
}
