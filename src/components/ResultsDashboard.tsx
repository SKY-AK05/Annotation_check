
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScoreCard } from "@/components/ScoreCard";
import type { BboxAnnotation, EvaluationResult } from "@/lib/types";
import { AlertCircle, CheckCircle, Download, FileCog, FileQuestion, MessageSquare, ShieldAlert, User } from "lucide-react";
import { Badge } from "./ui/badge";

interface ResultsDashboardProps {
  results: EvaluationResult[] | null;
  loading: boolean;
}

const Placeholder = () => (
  <Card className="flex flex-col items-center justify-center text-center p-8 h-full min-h-[500px] border-dashed">
    <FileQuestion className="h-16 w-16 text-muted-foreground mb-4" />
    <h3 className="text-xl font-semibold text-foreground">Awaiting Evaluation</h3>
    <p className="text-muted-foreground mt-2">Upload your annotation files and run the evaluation to see the results here.</p>
  </Card>
);

const SkeletonDashboard = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
    </CardContent>
  </Card>
);

const SingleResultDisplay = ({ result }: { result: EvaluationResult }) => {
    
    const getAnnotationLabel = (ann: BboxAnnotation) => {
      const categoryName = ann.attributes?.['label']
      const annotationId = `ID ${ann.id}`
      const matchKey = ann.attributes?.['Annotation No'] ? ` (Key: ${ann.attributes['Annotation No']})` : ''
      return `${categoryName || 'Unknown'}${matchKey || ` (${annotationId})`}`
    };

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
                            <h3 className="font-semibold">Feedback</h3>
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
                    <CardHeader className="pb-2"><CardTitle className="text-base">{result.matched.length} Matched</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>GT</TableHead><TableHead>Student</TableHead><TableHead>IoU</TableHead></TableRow></TableHeader>
                            <TableBody>{result.matched.map((m, i) => <TableRow key={i}><TableCell>{getAnnotationLabel(m.gt)}</TableCell><TableCell>{getAnnotationLabel(m.student)}</TableCell><TableCell>{m.iou.toFixed(2)}</TableCell></TableRow>)}</TableBody>
                        </Table>
                    </CardContent>
                </Card>
                    <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">{result.missed.length} Missed</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>GT Label</TableHead></TableRow></TableHeader>
                            <TableBody>{result.missed.map((m, i) => <TableRow key={i}><TableCell>{getAnnotationLabel(m.gt)}</TableCell></TableRow>)}</TableBody>
                        </Table>
                    </CardContent>
                </Card>
                    <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">{result.extra.length} Extra</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Student Label</TableHead></TableRow></TableHeader>
                            <TableBody>{result.extra.map((m, i) => <TableRow key={i}><TableCell>{getAnnotationLabel(m.student)}</TableCell></TableRow>)}</TableBody>
                        </Table>
                    </CardContent>
                </Card>
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
        </div>
    );
};

export function ResultsDashboard({ results, loading }: ResultsDashboardProps) {
  if (loading) return <SkeletonDashboard />;
  if (!results || results.length === 0) return <Placeholder />;

  const handleDownloadCsv = () => {
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

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <div className="flex items-center gap-3">
                 <CardTitle className="text-2xl">
                    Batch Evaluation Results
                </CardTitle>
                 <Badge variant="outline" className={`border-0 bg-primary/10 text-primary`}>
                    <User className="h-4 w-4 mr-1" />
                    {results.length} Students
                </Badge>
            </div>
          <CardDescription>
            Summary and detailed breakdown for each student file.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={handleDownloadCsv}>
          <Download className="mr-2 h-4 w-4" /> Download Summary CSV
        </Button>
      </CardHeader>
      <CardContent>
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
            <h3 className="text-lg font-semibold mb-2">Detailed Results</h3>
            {results.map((result) => (
                <AccordionItem value={result.studentFilename} key={result.studentFilename}>
                    <AccordionTrigger className="font-medium">{result.studentFilename}</AccordionTrigger>
                    <AccordionContent className="p-4 bg-muted/50 rounded-md">
                        <SingleResultDisplay result={result} />
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
