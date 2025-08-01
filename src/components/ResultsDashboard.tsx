'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreCard } from "@/components/ScoreCard";
import type { EvaluationResult } from "@/lib/types";
import { AlertCircle, CheckCircle, Download, FileQuestion, List, MessageSquare, ShieldAlert } from "lucide-react";

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
    csvContent += "Category,Detail\r\n";

    results.feedback.forEach(item => {
        csvContent += `Feedback,"${item.replace(/"/g, '""')}"\r\n`;
    });
    
    if (results.source === 'manual' && results.critical_issues) {
        results.critical_issues.forEach(item => {
            csvContent += `Critical Issue,"${item.replace(/"/g, '""')}"\r\n`;
        });
    } else if (results.source === 'ai_fallback' && results.issues) {
        results.issues.forEach(item => {
            csvContent += `AI Identified Issue,"${item.replace(/"/g, '""')}"\r\n`;
        });
    }
  
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "evaluation_feedback.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl">
            {results.source === 'ai_fallback' ? 'AI Fallback Evaluation' : 'Evaluation Results'}
          </CardTitle>
          <CardDescription>
            {results.source === 'ai_fallback' ? 'An AI approximated the score due to a processing error.' : 'Detailed breakdown of the annotation comparison.'}
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
              { (results.source === 'manual' && results.critical_issues.length > 0) || (results.source === 'ai_fallback' && results.issues && results.issues.length > 0) ? (
                <Card>
                  <CardHeader className="flex flex-row items-center space-x-3 space-y-0 pb-2">
                    <ShieldAlert className="h-5 w-5 text-destructive"/>
                    <h3 className="font-semibold">{results.source === 'ai_fallback' ? 'AI Identified Issues' : 'Critical Issues'}</h3>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                       {results.source === 'manual' ? 
                         results.critical_issues.map((item, index) => <li key={index} className="flex items-start"><AlertCircle className="h-4 w-4 text-destructive mr-2 mt-0.5 shrink-0"/><span>{item}</span></li>) :
                         results.issues?.map((item, index) => <li key={index} className="flex items-start"><AlertCircle className="h-4 w-4 text-destructive mr-2 mt-0.5 shrink-0"/><span>{item}</span></li>)
                       }
                    </ul>
                  </CardContent>
                </Card>
              ) : null }
          </div>
        </div>

        {results.source === 'manual' && (
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
                                <TableBody>{results.matched.map((m, i) => <TableRow key={i}><TableCell>{m.gt}</TableCell><TableCell>{m.student}</TableCell><TableCell>{m.iou.toFixed(2)}</TableCell></TableRow>)}</TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">{results.missed.length} Missed</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>GT Label</TableHead></TableRow></TableHeader>
                                <TableBody>{results.missed.map((m, i) => <TableRow key={i}><TableCell>{m.gt}</TableCell></TableRow>)}</TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">{results.extra.length} Extra</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Student Label</TableHead></TableRow></TableHeader>
                                <TableBody>{results.extra.map((m, i) => <TableRow key={i}><TableCell>{m.student}</TableCell></TableRow>)}</TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
            <TabsContent value="metrics">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <Card>
                        <CardHeader><CardTitle>Localization Accuracy</CardTitle></CardHeader>
                        <CardContent className="text-3xl font-bold">{results.average_iou.toFixed(3)} <span className="text-sm font-normal text-muted-foreground">Avg. IoU</span></CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Label Accuracy</CardTitle></CardHeader>
                        <CardContent className="text-3xl font-bold">{results.label_accuracy.accuracy}% <span className="text-sm font-normal text-muted-foreground">({results.label_accuracy.correct}/{results.label_accuracy.total} correct)</span></CardContent>
                    </Card>
                </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
