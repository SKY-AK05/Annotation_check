
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
    const [currentValue, setCurrentValue] = useState(String(Math.round(overrideScore ?? originalScore)));
    const inputRef = useRef<HTMLInputElement>(null);

    const isOverridden = overrideScore !== null && overrideScore !== undefined;

    useEffect(() => {
        setCurrentValue(String(Math.round(overrideScore ?? originalScore)));
    }, [originalScore, overrideScore]);
    
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        const newScore = parseInt(currentValue, 10);
        if (!isNaN(newScore) && newScore >= 0 && newScore <= 100) {
            // If new score is same as original, treat it as removing the override by passing null
            if (newScore === Math.round(originalScore)) {
                onSave(null);
            } else {
                onSave(newScore);
            }
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
        e.preventDefault(); // Prevents the input from losing focus and triggering onBlur
        handleSave();
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
                        onBlur={handleCancel}
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
