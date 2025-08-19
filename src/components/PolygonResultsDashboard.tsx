
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScoreCard } from "@/components/ScoreCard";
import type { PolygonAnnotation, PolygonEvaluationResult, PolygonMatch } from "@/lib/types";
import { PolygonViewer } from "@/components/PolygonViewer";
import { AlertCircle, CheckCircle, Download, FileQuestion, ImageIcon, MessageSquare, ShieldAlert, User, FileText } from "lucide-react";
import { Badge } from "./ui/badge";

interface PolygonResultsDashboardProps {
  results: PolygonEvaluationResult[] | null;
  loading: boolean;
  imageUrls: Map<string, string>;
}

const BatchSummary = ({ results }: { results: PolygonEvaluationResult[] }) => (
    <Card className="mb-6">
        <CardHeader>
            <CardTitle>Batch Summary</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Student File</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Avg. IoU</TableHead>
                        <TableHead className="text-right">Polygon Score</TableHead>
                        <TableHead className="text-right">Attribute Score</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {results.map((result) => (
                        <TableRow key={result.studentFilename}>
                            <TableCell className="font-medium">{result.studentFilename}</TableCell>
                            <TableCell className="text-right font-bold">{result.score}</TableCell>
                            <TableCell className="text-right">{(result.averageIoU * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-right">{result.averagePolygonScore.toFixed(1)}%</TableCell>
                            <TableCell className="text-right">{result.averageAttributeScore.toFixed(1)}%</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);

const ResultsDisplay = ({ results, imageUrls }: { results: PolygonEvaluationResult[], imageUrls: Map<string, string> }) => {

  const handleDownloadDetailedCsv = (result: PolygonEvaluationResult) => {
    const escapeCsv = (str: string | number | undefined) => {
        if (str === undefined || str === null) return '""';
        const s = String(str);
        if (s.includes('"') || s.includes(',')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return `"${s}"`;
    };

    let csv = [];
    csv.push(`"Summary for ${result.studentFilename}"`);
    csv.push(`"Metric","Value"`);
    csv.push(`"Score",${result.score}`);
    csv.push(`"Average IoU",${result.averageIoU.toFixed(4)}`);
    csv.push(`"Average Deviation Score","${result.averageDeviation.toFixed(2)}%"`);
    csv.push(`"Average Attribute Score","${result.averageAttributeScore.toFixed(2)}%"`);
    csv.push('');
    
    // Matched
    csv.push('"Matched Polygons"');
    csv.push(`"Image ID","GT ID","Student ID","IoU","Polygon Score","Attribute Score","Final Score"`);
    result.matched.forEach(m => {
        const row = [
            m.gt.image_id,
            m.gt.id,
            m.student.id,
            m.iou.toFixed(4),
            m.polygonScore.toFixed(2),
            m.attributeScore.toFixed(2),
            m.finalScore.toFixed(2),
        ].map(escapeCsv).join(',');
        csv.push(row);
    });
    csv.push('');

    // Missed
    csv.push('"Missed Polygons"');
    csv.push(`"Image ID","GT ID","GT Label"`);
    result.missed.forEach(m => {
        const row = [
            m.gt.image_id,
            m.gt.id,
            m.gt.attributes?.label,
        ].map(escapeCsv).join(',');
        csv.push(row);
    });
    csv.push('');

    // Extra
    csv.push('"Extra Polygons"');
    csv.push(`"Image ID","Student ID","Student Label"`);
    result.extra.forEach(e => {
        const row = [
            e.student.image_id,
            e.student.id,
            e.student.attributes?.label,
        ].map(escapeCsv).join(',');
        csv.push(row);
    });

    const csvContent = "data:text/csv;charset=utf-8," + csv.join("\r\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${result.studentFilename.replace(/[^a-z0-9]/gi, '_')}_polygon_result.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getImageNameById = (imageId: number, gtAnns: PolygonAnnotation[]): string => {
    // In CVAT, the image name is on the annotation itself, but not always in COCO.
    // The safest bet is to look up the image filename from the imageUrls map by its ID
    for(const [path, url] of imageUrls.entries()) {
        const baseName = path.split('/').pop()!;
        // CVAT exports sometimes name images like `image_train_5927.png`, where 5927 is NOT the image ID.
        // The most reliable thing is to match on the full path if available.
        if (path.includes(`_${imageId}.`) || baseName.startsWith(`${imageId}_`)) {
            return baseName;
        }
    }
    // Fallback if no direct match, which can happen with COCO style
    return `Image ID: ${imageId}`;
  };


  return (
    <>
      <div className="flex flex-row items-center justify-between mb-4">
        <div>
            <div className="flex items-center gap-3">
                 <h2 className="text-3xl">
                    Batch Evaluation Results
                </h2>
                 <Badge variant="outline" className={`border-2 border-foreground shadow-hard`}>
                    <User className="h-4 w-4 mr-1" />
                    {results.length} Students
                </Badge>
            </div>
          <p className="text-muted-foreground">
            Summary and detailed breakdown for each student file.
          </p>
        </div>
      </div>
        
        {results.length > 1 && <BatchSummary results={results} />}

        <Accordion type="single" collapsible className="w-full" defaultValue={results.length > 0 ? results[0].studentFilename : undefined}>
            <h3 className="text-2xl mb-2">Detailed Student Results</h3>
            {results.map((result) => (
                <AccordionItem value={result.studentFilename} key={result.studentFilename} className="card-style mb-4 overflow-hidden">
                    <AccordionTrigger className="font-bold text-lg p-4 hover:no-underline">
                       <div className="flex items-center justify-between w-full pr-4">
                           <span>{result.studentFilename}</span>
                           <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDownloadDetailedCsv(result); }}>
                                <FileText className="mr-2 h-4 w-4" />
                                Download CSV
                            </Button>
                       </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-muted">
                        <SingleResultDisplay result={result} imageUrls={imageUrls} getImageNameById={getImageNameById}/>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    </>
  )

}


const Legend = () => (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground mt-2 border-t pt-2">
        <div className="flex items-center gap-2"><div className="w-4 h-1 rounded-full" style={{ border: '2px solid rgba(0, 215, 255, 1)' }}></div><span>GT Polygon</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-1 rounded-full" style={{ border: '2px solid rgba(255, 0, 0, 1)' }}></div><span>Student Polygon</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(0, 215, 255, 0.5)' }}></div><span>Missed</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(255, 0, 0, 0.5)' }}></div><span>Extra</span></div>
    </div>
);


const SingleResultDisplay = ({ result, imageUrls, getImageNameById }: { result: PolygonEvaluationResult; imageUrls: Map<string, string>; getImageNameById: (id: number, annotations: PolygonAnnotation[]) => string; }) => {
    
    // Group all annotations by image ID for display
    const annotationsByImageId = new Map<number, { matched: PolygonMatch[], missed: { gt: PolygonAnnotation }[], extra: { student: PolygonAnnotation }[] }>();
    const allAnnotations = [...result.matched.map(m=>m.gt), ...result.missed.map(m=>m.gt), ...result.extra.map(e=>e.student)];

    result.matched.forEach(m => {
        const entry = annotationsByImageId.get(m.gt.image_id) || { matched: [], missed: [], extra: [] };
        entry.matched.push(m);
        annotationsByImageId.set(m.gt.image_id, entry);
    });
    result.missed.forEach(m => {
        const entry = annotationsByImageId.get(m.gt.image_id) || { matched: [], missed: [], extra: [] };
        entry.missed.push(m);
        annotationsByImageId.set(m.gt.image_id, entry);
    });
    result.extra.forEach(e => {
        const entry = annotationsByImageId.get(e.student.image_id) || { matched: [], missed: [], extra: [] };
        entry.extra.push(e);
        annotationsByImageId.set(e.student.image_id, entry);
    });


    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 flex items-center justify-center">
                    <ScoreCard score={result.score} />
                </div>
                <div className="md:col-span-2 space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center space-x-3 space-y-0 pb-2">
                            <MessageSquare className="h-5 w-5 text-primary"/>
                            <h3 className="font-bold">Overall Feedback</h3>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                            {result.feedback.map((item, index) => <li key={index} className="flex items-start"><CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0"/><span>{item}</span></li>)}
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <Card>
                    <CardHeader><CardTitle>Avg. Polygon Score</CardTitle></CardHeader>
                    <CardContent className="text-3xl font-bold">{result.averagePolygonScore.toFixed(1)}%</CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Avg. Attribute Score</CardTitle></CardHeader>
                    <CardContent className="text-3xl font-bold">{result.averageAttributeScore.toFixed(1)}%</CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Avg. IoU</CardTitle></CardHeader>
                    <CardContent className="text-3xl font-bold">{(result.averageIoU * 100).toFixed(1)}%</CardContent>
                </Card>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-2">Visual Comparison</h3>
                 <Accordion type="single" collapsible className="w-full" defaultValue={annotationsByImageId.keys().next().value?.toString()}>
                     {[...annotationsByImageId.entries()].map(([imageId, annotations]) => {
                        const imageName = result.imageNameMap.get(imageId);
                        
                        const imageUrl = imageUrls.get(imageName || '') || [...imageUrls.values()][0];

                        return (
                             <AccordionItem value={imageId.toString()} key={imageId} className="card-style mb-2 overflow-hidden">
                                <AccordionTrigger className="p-2 hover:no-underline">
                                    <span className="font-bold text-sm">{imageName || `Image ID: ${imageId}`}</span>
                                </AccordionTrigger>
                                <AccordionContent className="p-2 bg-muted/50">
                                   {imageUrl ? (
                                        <PolygonViewer 
                                            imageUrl={imageUrl} 
                                            annotations={annotations}
                                        />
                                   ) : (
                                        <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center text-sm text-muted-foreground">
                                            Image not provided for {imageName}
                                        </div>
                                   )}
                                </AccordionContent>
                             </AccordionItem>
                        )
                     })}
                 </Accordion>
                <Legend />
            </div>
        </div>
    );
};

export function PolygonResultsDashboard({ results, loading, imageUrls }: PolygonResultsDashboardProps) {
  
  return (
    <div>
        <h2 className="text-3xl mb-4">Evaluation Results</h2>
        {loading && !results ? (
            <div className="flex flex-col items-center justify-center text-center p-8 h-full min-h-[300px] border-dashed border-2 rounded-md bg-card">
                <FileQuestion className="h-16 w-16 text-muted-foreground mb-4 animate-pulse" />
                <h3 className="text-xl font-semibold text-foreground">Evaluating...</h3>
                <p className="text-muted-foreground mt-2">The results will appear here once the evaluation is complete.</p>
            </div>
        ) : results && results.length > 0 ? (
            <ResultsDisplay results={results} imageUrls={imageUrls} />
        ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 h-full min-h-[300px] border-dashed border-2 rounded-md bg-card">
                <FileQuestion className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-foreground font-sans">Awaiting Evaluation</h3>
                <p className="text-muted-foreground mt-2">Complete the form and run an evaluation to see results.</p>
            </div>
        )}
    </div>
  );
}
