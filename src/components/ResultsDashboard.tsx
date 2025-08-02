
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScoreCard } from "@/components/ScoreCard";
import type { BboxAnnotation, EvaluationResult, Match } from "@/lib/types";
import { AlertCircle, CheckCircle, Download, FileCog, FileQuestion, MessageSquare, ShieldAlert } from "lucide-react";
import { Badge } from "./ui/badge";

interface ResultsDashboardProps {
  results: EvaluationResult | null;
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
      <div className="flex justify-center">
        <Skeleton className="h-48 w-48 rounded-full" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-10 w-full max-w-sm" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </CardContent>
  </Card>
);

export function ResultsDashboard({ results, loading }: ResultsDashboardProps) {
  if (loading) return <SkeletonDashboard />;
  if (!results) return <Placeholder />;

  const handleDownloadCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Helper to get attribute string
    const getAttributesString = (ann: BboxAnnotation) => {
      return ann.attributes ? Object.entries(ann.attributes).map(([key, value]) => `${key}: ${value}`).join('; ') : '';
    }
    
    // Summary
    csvContent += "Category,Value,Detail\r\n";
    csvContent += `Overall Score,${results.score},\r\n`;
    csvContent += `Average IoU,${results.average_iou.toFixed(3)},\r\n`;
    csvContent += `Label Accuracy,${results.label_accuracy.accuracy.toFixed(1)}%,"${results.label_accuracy.correct}/${results.label_accuracy.total} correct"\r\n`;
    csvContent += `Attribute Accuracy,${results.attribute_accuracy.average_similarity.toFixed(1)}%,"${results.attribute_accuracy.total} attributes compared"\r\n`;
    csvContent += "\r\n";

    // Matched Annotations
    csvContent += "Matched Annotations\r\n";
    csvContent += "GT Annotation ID,GT Label,GT Attributes,Student Annotation ID,Student Label,Student Attributes,IoU,Label Match\r\n";
    results.matched.forEach(item => {
        const gtLabel = item.gt.attributes?.['label'] ?? `ID ${item.gt.id}`;
        const studentLabel = item.student.attributes?.['label'] ?? `ID ${item.student.id}`;
        csvContent += `"${item.gt.id}","${gtLabel}","${getAttributesString(item.gt)}","${item.student.id}","${studentLabel}","${getAttributesString(item.student)}",${item.iou.toFixed(3)},${item.isLabelMatch}\r\n`;
    });
    csvContent += "\r\n";

    // Missed Annotations
    csvContent += "Missed Annotations\r\n";
    csvContent += "GT Annotation ID,GT Label,GT Attributes\r\n";
    results.missed.forEach(item => {
        const gtLabel = item.gt.attributes?.['label'] ?? `ID ${item.gt.id}`;
        csvContent += `"${item.gt.id}","${gtLabel}","${getAttributesString(item.gt)}"\r\n`;
    });
    csvContent += "\r\n";

    // Extra Annotations
    csvContent += "Extra Annotations\r\n";
    csvContent += "Student Annotation ID,Student Label,Student Attributes\r\n";
    results.extra.forEach(item => {
        const studentLabel = item.student.attributes?.['label'] ?? `ID ${item.student.id}`;
        csvContent += `"${item.student.id}","${studentLabel}","${getAttributesString(item.student)}"\r\n`;
    });
    csvContent += "\r\n";

    // Feedback
    csvContent += "Feedback\r\n";
    csvContent += "Message\r\n";
    results.feedback.forEach(item => {
        csvContent += `"${item.replace(/"/g, '""')}"\r\n`;
    });
    csvContent += "\r\n";
    
    // Critical Issues
    if (results.critical_issues && results.critical_issues.length > 0) {
        csvContent += "Critical Issues\r\n";
        csvContent += "Message\r\n";
        results.critical_issues.forEach(item => {
            csvContent += `"${item.replace(/"/g, '""')}"\r\n`;
        });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "evaluation_results_detailed.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const resultSource = { label: 'Rule-Based', icon: <FileCog className="h-4 w-4" />, color: 'bg-primary/10 text-primary' };
  
  const getAnnotationLabel = (ann: BboxAnnotation) => {
    return ann.attributes?.['label'] || `ID ${ann.id}`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <div className="flex items-center gap-3">
                 <CardTitle className="text-2xl">
                    Evaluation Results
                </CardTitle>
                <Badge variant="outline" className={`border-0 ${resultSource.color}`}>
                    {resultSource.icon}
                    {resultSource.label}
                </Badge>
            </div>
          <CardDescription>
            Detailed breakdown of the annotation comparison.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={handleDownloadCsv}>
          <Download className="mr-2 h-4 w-4" /> Download CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 flex items-center justify-center">
            <ScoreCard score={results.score} />
          </div>
          <div className="md:col-span-2 space-y-4">
              <Card>
                  <CardHeader className="flex flex-row items-center space-x-3 space-y-0 pb-2">
                    <MessageSquare className="h-5 w-5 text-primary"/>
                    <h3 className="font-semibold">Feedback</h3>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {results.feedback.map((item, index) => <li key={index} className="flex items-start"><CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0"/><span>{item}</span></li>)}
                    </ul>
                  </CardContent>
              </Card>
              { (results.critical_issues && results.critical_issues.length > 0) ? (
                <Card>
                  <CardHeader className="flex flex-row items-center space-x-3 space-y-0 pb-2">
                    <ShieldAlert className="h-5 w-5 text-destructive"/>
                    <h3 className="font-semibold">Critical Issues</h3>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                       {results.critical_issues.map((item, index) => <li key={index} className="flex items-start"><AlertCircle className="h-4 w-4 text-destructive mr-2 mt-0.5 shrink-0"/><span>{item}</span></li>)}
                    </ul>
                  </CardContent>
                </Card>
              ) : null }
          </div>
        </div>

        <Tabs defaultValue="details" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Detailed Breakdown</TabsTrigger>
              <TabsTrigger value="metrics">Accuracy Metrics</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">{results.matched.length} Matched</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>GT</TableHead><TableHead>Student</TableHead><TableHead>IoU</TableHead></TableRow></TableHeader>
                                <TableBody>{results.matched.map((m, i) => <TableRow key={i}><TableCell>{getAnnotationLabel(m.gt)}</TableCell><TableCell>{getAnnotationLabel(m.student)}</TableCell><TableCell>{m.iou.toFixed(2)}</TableCell></TableRow>)}</TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">{results.missed.length} Missed</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>GT Label</TableHead></TableRow></TableHeader>
                                <TableBody>{results.missed.map((m, i) => <TableRow key={i}><TableCell>{getAnnotationLabel(m.gt)}</TableCell></TableRow>)}</TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">{results.extra.length} Extra</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Student Label</TableHead></TableRow></TableHeader>
                                <TableBody>{results.extra.map((m, i) => <TableRow key={i}><TableCell>{getAnnotationLabel(m.student)}</TableCell></TableRow>)}</TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
            <TabsContent value="metrics">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <Card>
                        <CardHeader><CardTitle>Localization Accuracy</CardTitle></CardHeader>
                        <CardContent className="text-3xl font-bold">{results.average_iou.toFixed(3)} <span className="text-sm font-normal text-muted-foreground">Avg. IoU</span></CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Label Accuracy</CardTitle></CardHeader>
                        <CardContent className="text-3xl font-bold">{results.label_accuracy.accuracy.toFixed(0)}% <span className="text-sm font-normal text-muted-foreground">({results.label_accuracy.correct}/{results.label_accuracy.total} correct)</span></CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle>Attribute Accuracy</CardTitle></CardHeader>
                        <CardContent className="text-3xl font-bold">{results.attribute_accuracy.average_similarity.toFixed(0)}% <span className="text-sm font-normal text-muted-foreground">({results.attribute_accuracy.total} attributes)</span></CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
