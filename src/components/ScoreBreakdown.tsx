
'use client';

import React from 'react';
import type { Match } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, Award } from 'lucide-react';
import { Badge } from './ui/badge';

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
    const { iou, labelSimilarity, attributeScores, originalScore, overrideScore } = match;

    const iouScore = iou * 50;
    const labelScore = labelSimilarity * 25;
    
    const totalPossibleAttrScore = attributeScores.length > 0 ? 25 : 0;

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
                            <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">IoU</TableCell>
                            <TableCell>{iou.toFixed(3)}</TableCell>
                            <TableCell className={`text-right font-mono ${getScoreColor(iouScore, 50)}`}>
                                {iouScore.toFixed(1)} / 50.0
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Label</TableCell>
                            <TableCell className="flex items-center gap-2">
                                {labelSimilarity === 1 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                <span>{match.student.attributes?.label ?? 'N/A'}</span>
                            </TableCell>
                             <TableCell className={`text-right font-mono ${getScoreColor(labelScore, 25)}`}>
                                {labelScore.toFixed(1)} / 25.0
                            </TableCell>
                        </TableRow>
                        {attributeScores.map(attr => {
                             const attrScoreValue = attr.similarity * (totalPossibleAttrScore / (attributeScores.length || 1));
                             return (
                                <TableRow key={attr.name}>
                                    <TableCell className="font-medium pl-6 text-muted-foreground">Attribute: {attr.name}</TableCell>
                                    <TableCell className="flex items-center gap-2">
                                        {attr.similarity === 1 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                        <span>{attr.gtValue ?? 'N/A'} vs {attr.studentValue ?? 'N/A'}</span>
                                    </TableCell>
                                    <TableCell className={`text-right font-mono ${getScoreColor(attrScoreValue, (totalPossibleAttrScore / (attributeScores.length || 1)))}`}>
                                        {attrScoreValue.toFixed(1)} / {(totalPossibleAttrScore / (attributeScores.length || 1)).toFixed(1)}
                                    </TableCell>
                                </TableRow>
                             )
                        })}
                        <TableRow className="font-bold bg-muted/50">
                            <TableCell>Final Score</TableCell>
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
