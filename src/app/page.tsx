
'use client';

import { useState } from 'react';
import type { FormValues } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { EvaluationForm } from '@/components/EvaluationForm';
import { ResultsDashboard } from '@/components/ResultsDashboard';
import { RuleConfiguration } from '@/components/RuleConfiguration';
import { AnnotatorAiLogo } from '@/components/AnnotatorAiLogo';
import type { EvaluationResult } from '@/lib/types';
import { evaluateAnnotations } from '@/lib/evaluator';
import { parseCvatXml } from '@/lib/cvat-xml-parser';
import { extractEvalSchema, type EvalSchema } from '@/ai/flows/extract-eval-schema';

export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingRules, setIsGeneratingRules] = useState<boolean>(false);
  const [results, setResults] = useState<EvaluationResult | null>(null);
  const [evalSchema, setEvalSchema] = useState<EvalSchema | null>(null);
  const { toast } = useToast();

  const handleGtFileChange = async (file: File | undefined) => {
    if (!file) {
      setEvalSchema(null);
      return;
    }
    
    setIsGeneratingRules(true);
    setResults(null);
    setEvalSchema(null);
    try {
      const fileContent = await file.text();
      const schema = await extractEvalSchema({ gtFileContent: fileContent });
      setEvalSchema(schema);
      toast({
        title: "Evaluation Rules Generated",
        description: "The evaluation schema has been extracted from your GT file.",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Error Generating Rules",
        description: `Could not process the GT file: ${(e as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRules(false);
    }
  }

  const handleEvaluate = async (data: FormValues) => {
    if (!evalSchema) {
      toast({
        title: "Evaluation Rules Missing",
        description: "Please upload a Ground Truth file first to generate rules.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    setResults(null);
  
    const gtFileContent = await data.gtFile.text();
    const studentFileContent = await data.studentFile.text();

    try {
      if (['polygon', 'keypoints'].includes(data.toolType)) {
          toast({
              title: 'Evaluation Not Supported',
              description: 'This tool only supports COCO JSON (Bounding Box) and CVAT XML evaluation.',
              variant: 'destructive',
          });
          return;
      }
      
      // Standard evaluation logic
      let gtAnnotations, studentAnnotations;
      try {
         if (data.toolType === 'cvat_xml') {
            gtAnnotations = parseCvatXml(gtFileContent);
            studentAnnotations = parseCvatXml(studentFileContent);
        } else if (data.toolType === 'bounding_box') { // Assuming COCO JSON
            gtAnnotations = JSON.parse(gtFileContent);
            studentAnnotations = JSON.parse(studentFileContent);
        } else {
             throw new Error(`Tool type '${data.toolType}' is not supported for manual evaluation.`);
        }
      } catch (e) {
        throw new Error(`File Parsing Error: ${(e as Error).message}`);
      }
      
      const manualResult = evaluateAnnotations(gtAnnotations, studentAnnotations, evalSchema);
      setResults(manualResult);
      toast({
        title: "Evaluation Complete",
        description: "Standard evaluation logic was successful.",
      });

    } catch (e) {
      console.error(e);
      const error = e as Error;
      toast({
        title: "Evaluation Error",
        description: `${error.message}.`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 md:p-12 bg-light-blue">
      <header className="w-full max-w-7xl flex items-center justify-start mb-8">
        <AnnotatorAiLogo className="h-10 w-10 text-primary" />
        <h1 className="text-3xl font-bold ml-4 tracking-tight">Annotator AI</h1>
      </header>
      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 flex flex-col gap-8 lg:sticky lg:top-12">
          <EvaluationForm onEvaluate={handleEvaluate} isLoading={isLoading || isGeneratingRules} onGtFileChange={handleGtFileChange} />
          <RuleConfiguration schema={evalSchema} loading={isGeneratingRules} />
        </div>
        <div className="lg:col-span-2">
          <ResultsDashboard results={results} loading={isLoading} />
        </div>
      </main>
    </div>
  );
}
