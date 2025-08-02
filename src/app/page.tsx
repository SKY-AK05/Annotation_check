
'use client';

import { useState } from 'react';
import type { FormValues } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { EvaluationForm } from '@/components/EvaluationForm';
import { ResultsDashboard } from '@/components/ResultsDashboard';
import { AnnotatorAiLogo } from '@/components/AnnotatorAiLogo';
import type { EvaluationResult } from '@/lib/types';
import { evaluateAnnotations } from '@/lib/evaluator';
import { parseCvatXml } from '@/lib/cvat-xml-parser';


export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<EvaluationResult | null>(null);
  const { toast } = useToast();

  const handleEvaluate = async (data: FormValues) => {
    setIsLoading(true);
    setResults(null);
  
    try {
      const gtFile = data.gtFile;
      const studentFile = data.studentFile;

      const gtAnnotationsText = await gtFile.text();
      const studentAnnotationsText = await studentFile.text();

      let gtAnnotations, studentAnnotations;

      try {
         if (data.toolType === 'cvat_xml') {
            gtAnnotations = parseCvatXml(gtAnnotationsText);
            studentAnnotations = parseCvatXml(studentAnnotationsText);
            toast({
              title: "CVAT XML Parsed",
              description: "Successfully parsed CVAT XML files.",
            });
        } else if (data.toolType === 'bounding_box') {
            gtAnnotations = JSON.parse(gtAnnotationsText);
            studentAnnotations = JSON.parse(studentAnnotationsText);
        } else {
             throw new Error(`Tool type '${data.toolType}' is not supported for manual evaluation.`);
        }
      } catch (e) {
        toast({
          title: "File Parsing Error",
          description: `An error occurred while parsing the files: ${(e as Error).message}`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      const manualResult = evaluateAnnotations(gtAnnotations, studentAnnotations);
      setResults(manualResult);
      toast({
        title: "Evaluation Complete",
        description: "Standard evaluation logic was successful.",
      });

    } catch (e) {
      console.error(e);
      const error = e as Error;
      toast({
        title: "Error",
        description: `An unexpected error occurred during evaluation: ${error.message}.`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 md:p-12">
      <header className="w-full max-w-7xl flex items-center justify-start mb-8">
        <AnnotatorAiLogo className="h-10 w-10 text-primary" />
        <h1 className="text-3xl font-bold ml-4 tracking-tight">Annotator AI</h1>
      </header>
      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="lg:sticky lg:top-12">
          <EvaluationForm onEvaluate={handleEvaluate} isLoading={isLoading} />
        </div>
        <ResultsDashboard results={results} loading={isLoading} />
      </main>
    </div>
  );
}
