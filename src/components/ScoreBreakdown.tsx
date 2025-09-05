
'use client';

import React from 'react';
import type { Match } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, Award } from 'lucide-react';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface ScoreBreakdownProps {
    match: Match;
}

const getScoreColor = (score: number, maxScore: number) => {
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    if (percentage >= 90) return 'text-green-500';
    if (percentage >= 70) return 'text-yellow-500';
    return 'text-red-500';
}

export function ScoreBreakdown({ match }: ScoreBreakdownProps) {
    const { iou, labelSimilarity, attributeScores, originalScore, overrideScore, scoringMethod } = match;

    const iouScore = iou * 100;
    const labelScore = labelSimilarity * 100;
    const attrScore = match.attributeSimilarity * 100;
    
    const isLabelScored = scoringMethod === 'full';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Award className="h-5 w-5" />
                    Score Breakdown
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Component</TableHead>
                            <TableHead>Value (GT vs Student)</TableHead>
                            <TableHead className="text-right">Component Score</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">IoU</TableCell>
                            <TableCell>{iou.toFixed(3)}</TableCell>
                            <TableCell className={`text-right font-mono ${getScoreColor(iouScore, 100)}`}>
                                {iouScore.toFixed(1)} / 100.0
                            </TableCell>
                        </TableRow>
                        <TableRow className={cn(!isLabelScored && "text-muted-foreground opacity-60")}>
                            <TableCell className="font-medium">
                                Label
                                {!isLabelScored && <Badge variant="outline" className="ml-2 text-xs">Not Scored</Badge>}
                            </TableCell>
                            <TableCell className="flex items-center gap-2">
                                {labelSimilarity === 1 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                <span>{match.student.attributes?.label ?? 'N/A'}</span>
                            </TableCell>
                             <TableCell className={`text-right font-mono ${getScoreColor(labelScore, 100)}`}>
                                {isLabelScored ? `${labelScore.toFixed(1)} / 100.0` : 'N/A'}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Attributes</TableCell>
                            <TableCell>
                                {attributeScores.length === 0 ? "No attributes to compare" : `${attributeScores.length} checked`}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${getScoreColor(attrScore, 100)}`}>
                                {attrScore.toFixed(1)} / 100.0
                            </TableCell>
                        </TableRow>
                        {attributeScores.map(attr => (
                            <TableRow key={attr.name}>
                                <TableCell className="font-medium pl-6 text-muted-foreground text-xs">{attr.name}</TableCell>
                                <TableCell className="flex items-center gap-2 text-xs">
                                    {attr.similarity === 1 ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                                    <span>"{attr.gtValue ?? ''}" vs "{attr.studentValue ?? ''}"</span>
                                </TableCell>
                                <TableCell className={`text-right font-mono text-xs ${getScoreColor(attr.similarity * 100, 100)}`}>
                                    {(attr.similarity*100).toFixed(0)}
                                </TableCell>
                            </TableRow>
                        ))}
                        <TableRow className="font-bold bg-muted/50">
                            <TableCell>Match Quality</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right font-mono">
                                {isFinite(overrideScore ?? -1) && overrideScore !== null ? (
                                    <div className="flex flex-col items-end">
                                        <span className='text-amber-500'>{overrideScore.toFixed(1)} / 100.0</span>
                                        <span className='text-xs line-through text-muted-foreground'>{originalScore.toFixed(1)}</span>
                                    </div>
                                ) : (
                                    `${originalScore.toFixed(1)} / 100.0`
                                )}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

    