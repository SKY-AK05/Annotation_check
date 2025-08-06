
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScoreCard } from "@/components/ScoreCard";
import type { BboxAnnotation, EvaluationResult, ImageEvaluationResult } from "@/lib/types";
import type { FormValues } from '@/lib/types';
import type { EvalSchema } from "@/ai/flows/extract-eval-schema";
import { AnnotationViewer } from "@/components/AnnotationViewer";
import { AlertCircle, CheckCircle, Download, FileQuestion, FileText, ImageIcon, MessageSquare, ShieldAlert, User, FileCog, Code2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { EvaluationForm } from "./EvaluationForm";
import { RuleConfiguration } from "./RuleConfiguration";
import { Separator } from "./ui/separator";

interface ResultsDashboardProps {
  results: EvaluationResult[] | null;
  loading: boolean;
  imageUrls: Map<string, string>;
  onEvaluate: (data: FormValues) => void;
  onGtFileChange: (file: File | undefined) => void;
  evalSchema: EvalSchema | null;
  onRuleChange: (instructions: { pseudoCode?: string; userInstructions?: string }) => void;
}

const ResultsDisplay = ({ results, imageUrls }: { results: EvaluationResult[], imageUrls: Map<string, string> }) => {

  const handleDownloadSummaryCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header
    csvContent += "Student Filename,Score,Avg IoU,Label Accuracy,Correct Labels,Total Labels,Attribute Accuracy,Attributes Compared,Matched Count,Missed Count,Extra Count,Feedback,Critical Issues\r\n";

    results.forEach(result => {
        const studentFilename = `"${result.studentFilename}"`;
        const score = result.score;
        const avgIoU = result.average_iou.toFixed(3);
        const labelAccuracy = result.label_accuracy.accuracy.toFixed(1);
        const correctLabels = result.label_accuracy.correct;
        const totalLabels = result.label_accuracy.total;
        const attributeAccuracy = result.attribute_accuracy.average_similarity.toFixed(1);
        const attributesCompared = result.attribute_accuracy.total;
        const matchedCount = result.matched.length;
        const missedCount = result.missed.length;
        const extraCount = result.extra.length;
        const feedback = `"${result.feedback.join('. ')}"`;
        const criticalIssues = `"${result.critical_issues.join('. ')}"`;

        const row = [studentFilename, score, avgIoU, labelAccuracy, correctLabels, totalLabels, attributeAccuracy, attributesCompared, matchedCount, missedCount, extraCount, feedback, criticalIssues].join(',');
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "batch_evaluation_summary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleDownloadDetailedCsv = (result: EvaluationResult) => {
    const escapeCsv = (str: string | number | undefined) => {
        if (str === undefined || str === null) return '""';
        const s = String(str);
        if (s.includes('"') || s.includes(',')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return `"${s}"`;
    };

    let csv = [];

    // Summary
    csv.push(`"Summary for ${result.studentFilename}"`);
    csv.push(`"Metric","Value"`);
    csv.push(`"Score",${result.score}`);
    csv.push(`"Average IoU",${result.average_iou.toFixed(4)}`);
    csv.push(`"Label Accuracy","${result.label_accuracy.accuracy.toFixed(2)}%"`);
    csv.push(`"Attribute Accuracy","${result.attribute_accuracy.average_similarity.toFixed(2)}%"`);
    csv.push(`"Matched Detections",${result.matched.length}`);
    csv.push(`"Missed Detections",${result.missed.length}`);
    csv.push(`"Extra Detections",${result.extra.length}`);
    csv.push('');

    // Feedback & Issues
    csv.push('"Feedback"');
    result.feedback.forEach(f => csv.push(escapeCsv(f)));
    csv.push('');
    csv.push('"Critical Issues"');
    result.critical_issues.forEach(i => csv.push(escapeCsv(i)));
    csv.push('');
    csv.push('---');
    csv.push('');

    // Per-Image Breakdown
    result.image_results.forEach(imgResult => {
        csv.push(`"Image: ${imgResult.imageName}"`);
        csv.push('');

        // Matched
        csv.push('"Matched Annotations"');
        csv.push(`"GT ID","GT Label","GT Bbox","Student ID","Student Label","Student Bbox","IoU","Label Match","Attribute Similarity"`);
        imgResult.matched.forEach(m => {
            const row = [
                m.gt.id,
                m.gt.attributes?.label,
                m.gt.bbox.join(';'),
                m.student.id,
                m.student.attributes?.label,
                m.student.bbox.join(';'),
                m.iou.toFixed(4),
                m.isLabelMatch,
                m.attributeSimilarity.toFixed(4),
            ].map(escapeCsv).join(',');
            csv.push(row);
        });
        csv.push('');

        // Missed
        csv.push('"Missed Annotations"');
        csv.push(`"GT ID","GT Label","GT Bbox"`);
        imgResult.missed.forEach(m => {
            const row = [
                m.gt.id,
                m.gt.attributes?.label,
                m.gt.bbox.join(';'),
            ].map(escapeCsv).join(',');
            csv.push(row);
        });
        csv.push('');

        // Extra
        csv.push('"Extra Annotations"');
        csv.push(`"Student ID","Student Label","Student Bbox"`);
        imgResult.extra.forEach(e => {
            const row = [
                e.student.id,
                e.student.attributes?.label,
                e.student.bbox.join(';'),
            ].map(escapeCsv).join(',');
            csv.push(row);
        });
        csv.push('');
        csv.push('---');
        csv.push('');
    });

    const csvContent = "data:text/csv;charset=utf-8," + csv.join("\r\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${result.studentFilename.replace(/[^a-z0-9]/gi, '_')}_detailed_result.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="flex flex-row items-center justify-between mb-4">
        <div>
            <div className="flex items-center gap-3">
                 <h2 className="text-2xl font-bold tracking-tight">
                    Batch Evaluation Results
                </h2>
                 <Badge variant="outline" className={`border-0 bg-primary/10 text-primary`}>
                    <User className="h-4 w-4 mr-1" />
                    {results.length} Students
                </Badge>
            </div>
          <p className="text-muted-foreground">
            Summary and detailed breakdown for each student file.
          </p>
        </div>
        <Button variant="outline" onClick={handleDownloadSummaryCsv}>
          <Download className="mr-2 h-4 w-4" /> Download Summary CSV
        </Button>
      </div>

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
                            <TableHead className="text-right">Label Acc.</TableHead>
                            <TableHead className="text-right">Attribute Acc.</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {results.map((result) => (
                            <TableRow key={result.studentFilename}>
                                <TableCell className="font-medium">{result.studentFilename}</TableCell>
                                <TableCell className="text-right font-bold">{result.score}</TableCell>
                                <TableCell className="text-right">{(result.average_iou * 100).toFixed(1)}%</TableCell>
                                <TableCell className="text-right">{result.label_accuracy.accuracy.toFixed(1)}%</TableCell>
                                <TableCell className="text-right">{result.attribute_accuracy.average_similarity.toFixed(1)}%</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        
        <Accordion type="single" collapsible className="w-full">
            <h3 className="text-lg font-semibold mb-2">Detailed Student Results</h3>
            {results.map((result) => (
                <AccordionItem value={result.studentFilename} key={result.studentFilename}>
                    <AccordionTrigger className="font-medium">
                       <div className="flex items-center justify-between w-full pr-4">
                           <span>{result.studentFilename}</span>
                           <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDownloadDetailedCsv(result); }}>
                                <FileText className="mr-2 h-4 w-4" />
                                Download CSV
                            </Button>
                       </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-muted/50 rounded-md">
                        <SingleResultDisplay result={result} onDownloadCsv={handleDownloadDetailedCsv} imageUrls={imageUrls}/>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    </>
  )

}


const Legend = () => (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground mt-2 border-t pt-2">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(0, 255, 0, 0.7)' }}></div><span>GT (Matched)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(0, 0, 255, 0.7)' }}></div><span>Student (Matched)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(255, 0, 0, 0.9)' }}></div><span>Missed</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(255, 165, 0, 0.9)' }}></div><span>Extra</span></div>
    </div>
);


const ImageResultDisplay = ({ imageResult, imageUrl }: { imageResult: ImageEvaluationResult, imageUrl: string | undefined }) => {
    const getAnnotationLabel = (ann: BboxAnnotation) => {
      const categoryName = ann.attributes?.['label']
      const annotationId = `ID ${ann.id}`
      const matchKey = ann.attributes?.['Annotation No'] ? ` (Key: ${ann.attributes['Annotation No']})` : ''
      return `${categoryName || 'Unknown'}${matchKey || ` (${annotationId})`}`
    };

    return (
        <Card className="bg-background">
            <CardHeader className="p-4">
                <CardTitle className="text-lg flex items-center gap-2">
                    <ImageIcon className="h-5 w-5"/>
                    {imageResult.imageName}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="md:col-span-3">
                   {imageUrl ? (
                        <div>
                            <AnnotationViewer
                                imageUrl={imageUrl}
                                imageResult={imageResult}
                            />
                            <Legend />
                        </div>
                    ) : (
                        <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center text-sm text-muted-foreground">
                            Image not provided
                        </div>
                    )}
                </div>
                 <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">{imageResult.matched.length} Matched</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>GT</TableHead><TableHead>Student</TableHead><TableHead>IoU</TableHead></TableRow></TableHeader>
                            <TableBody>{imageResult.matched.map((m, i) => <TableRow key={i}><TableCell>{getAnnotationLabel(m.gt)}</TableCell><TableCell>{getAnnotationLabel(m.student)}</TableCell><TableCell>{m.iou.toFixed(2)}</TableCell></TableRow>)}</TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">{imageResult.missed.length} Missed</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>GT Label</TableHead></TableRow></TableHeader>
                            <TableBody>{imageResult.missed.map((m, i) => <TableRow key={i}><TableCell>{getAnnotationLabel(m.gt)}</TableCell></TableRow>)}</TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">{imageResult.extra.length} Extra</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Student Label</TableHead></TableRow></TableHeader>
                            <TableBody>{imageResult.extra.map((m, i) => <TableRow key={i}><TableCell>{getAnnotationLabel(m.student)}</TableCell></TableRow>)}</TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
    )
}

const SingleResultDisplay = ({ result, onDownloadCsv, imageUrls }: { result: EvaluationResult; onDownloadCsv: (result: EvaluationResult) => void; imageUrls: Map<string, string>; }) => {
    
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
                            <h3 className="font-semibold">Overall Feedback</h3>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                            {result.feedback.map((item, index) => <li key={index} className="flex items-start"><CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0"/><span>{item}</span></li>)}
                            </ul>
                        </CardContent>
                    </Card>
                    { (result.critical_issues && result.critical_issues.length > 0) ? (
                        <Card>
                        <CardHeader className="flex flex-row items-center space-x-3 space-y-0 pb-2">
                            <ShieldAlert className="h-5 w-5 text-destructive"/>
                            <h3 className="font-semibold">Critical Issues</h3>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                            {result.critical_issues.map((item, index) => <li key={index} className="flex items-start"><AlertCircle className="h-4 w-4 text-destructive mr-2 mt-0.5 shrink-0"/><span>{item}</span></li>)}
                            </ul>
                        </CardContent>
                        </Card>
                    ) : null }
                </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <Card>
                    <CardHeader><CardTitle>Localization Accuracy</CardTitle></CardHeader>
                    <CardContent className="text-3xl font-bold">{result.average_iou.toFixed(3)} <span className="text-sm font-normal text-muted-foreground">Avg. IoU</span></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Label Accuracy</CardTitle></CardHeader>
                    <CardContent className="text-3xl font-bold">{result.label_accuracy.accuracy.toFixed(0)}% <span className="text-sm font-normal text-muted-foreground">({result.label_accuracy.correct}/{result.label_accuracy.total} correct)</span></CardContent>
                </Card>
                    <Card>
                    <CardHeader><CardTitle>Attribute Accuracy</CardTitle></CardHeader>
                    <CardContent className="text-3xl font-bold">{result.attribute_accuracy.average_similarity.toFixed(0)}% <span className="text-sm font-normal text-muted-foreground">({result.attribute_accuracy.total} attributes)</span></CardContent>
                </Card>
            </div>
             <Accordion type="single" collapsible className="w-full mt-6">
                <h3 className="font-semibold mb-2">Per-Image Breakdown</h3>
                 {result.image_results.map((imageResult) => (
                    <AccordionItem value={imageResult.imageName} key={imageResult.imageName}>
                        <AccordionTrigger className="font-normal text-sm bg-muted/30 px-4 rounded-md">
                            {imageResult.imageName}
                        </AccordionTrigger>
                        <AccordionContent className="p-2">
                           <ImageResultDisplay imageResult={imageResult} imageUrl={imageUrls.get(imageResult.imageName)} />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
};

export function ResultsDashboard({ results, loading, imageUrls, onEvaluate, onGtFileChange, evalSchema, onRuleChange }: ResultsDashboardProps) {
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <FileCog className="w-6 h-6" />
            New Evaluation
        </CardTitle>
        <CardDescription>Upload annotations to compare and score.</CardDescription>
      </CardHeader>
      <CardContent>
        <EvaluationForm 
            onEvaluate={onEvaluate} 
            isLoading={loading} 
            onGtFileChange={onGtFileChange}
        />
        <Separator className="my-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2">
              {loading && !results ? (
                  <div className="flex flex-col items-center justify-center text-center p-8 h-full min-h-[400px] border-dashed border-2 rounded-md">
                    <FileQuestion className="h-16 w-16 text-muted-foreground mb-4 animate-pulse" />
                    <h3 className="text-xl font-semibold text-foreground">Evaluating...</h3>
                    <p className="text-muted-foreground mt-2">The results will appear here once the evaluation is complete.</p>
                  </div>
              ) : results ? (
                  <ResultsDisplay results={results} imageUrls={imageUrls} />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 h-full min-h-[400px] border-dashed border-2 rounded-md">
                  <FileQuestion className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground">Awaiting Evaluation</h3>
                  <p className="text-muted-foreground mt-2">Complete the form and run an evaluation to see results.</p>
                </div>
              )}
            </div>
            <div className="lg:col-span-1 flex flex-col gap-8">
              <RuleConfiguration 
                  schema={evalSchema} 
                  loading={loading} 
                  onRuleChange={onRuleChange} 
              />
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

    