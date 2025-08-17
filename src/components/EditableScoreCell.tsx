
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableScoreCellProps {
    originalScore: number;
    overrideScore?: number | null;
    onSave: (newScore: number | null) => void;
}

export function EditableScoreCell({ originalScore, overrideScore, onSave }: EditableScoreCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    // Initialize with the final score shown to the user
    const [currentValue, setCurrentValue] = useState(String(Math.round(overrideScore ?? originalScore)));
    const inputRef = useRef<HTMLInputElement>(null);

    const isOverridden = overrideScore !== null && overrideScore !== undefined;

    useEffect(() => {
        // Always reflect the most current score when not editing
        setCurrentValue(String(Math.round(overrideScore ?? originalScore)));
    }, [originalScore, overrideScore]);
    
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        const newScoreNum = parseInt(currentValue, 10);
        
        if (!isNaN(newScoreNum) && newScoreNum >= 0 && newScoreNum <= 100) {
            // The parent component will decide if this is an override or a reset
            onSave(newScoreNum);
        } else {
            // If input is invalid, just cancel
            handleCancel();
        }
        setIsEditing(false);
    };
    
    const handleCancel = () => {
        setCurrentValue(String(Math.round(overrideScore ?? originalScore)));
        setIsEditing(false);
    }
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    }
    
    const handleSaveMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault(); // Prevents input from losing focus and blurring before save
        handleSave();
    };
    
    const handleInputBlur = () => {
        // We use a small timeout to allow the save button's mousedown event to fire first
        setTimeout(() => {
            if (isEditing) {
                handleCancel();
            }
        }, 150);
    };

    if (isEditing) {
        return (
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                    <Input
                        ref={inputRef}
                        type="number"
                        min="0"
                        max="100"
                        value={currentValue}
                        onChange={(e) => setCurrentValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleInputBlur}
                        className="h-8 w-20 text-right"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onMouseDown={handleSaveMouseDown}><Check className="h-4 w-4 text-green-500"/></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancel}><X className="h-4 w-4 text-red-500"/></Button>
                </div>
            </TableCell>
        );
    }

    return (
        <TableCell 
            className="text-right cursor-pointer group"
            onClick={() => setIsEditing(true)}
        >
            <div className="flex items-center justify-end gap-2">
               {isOverridden && (
                  <span className="text-xs text-muted-foreground line-through">
                      {Math.round(originalScore)}
                  </span>
               )}
                <span className={cn("font-bold", isOverridden && "text-amber-500")}>
                    {Math.round(overrideScore ?? originalScore)}
                </span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </TableCell>
    );
}
