
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
  
    try {
        const gtFileContent = await data.gtFile.text();
        const studentFileContent = await data.studentFile.text();

        let gtAnnotations, studentAnnotations;
        
        const isXmlFile = (content: string) => content.trim().startsWith('<?xml');

        // Determine file types and parse accordingly
        if (data.toolType === 'cvat_xml' || isXmlFile(gtFileContent)) {
            gtAnnotations = parseCvatXml(gtFileContent);
        } else {
            gtAnnotations = JSON.parse(gtFileContent);
        }

        if (data.toolType === 'cvat_xml' || isXmlFile(studentFileContent)) {
            studentAnnotations = parseCvatXml(studentFileContent);
        } else {
            studentAnnotations = JSON.parse(studentFileContent);
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
        description: `${error.message}. Please check file formats and try again.`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchemaChange = (newSchema: EvalSchema) => {
    setEvalSchema(newSchema);
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
          <RuleConfiguration schema={evalSchema} loading={isGeneratingRules} onSchemaChange={handleSchemaChange} />
        </div>
        <div className="lg:col-span-2">
          <ResultsDashboard results={results} loading={isLoading} />
        </div>
      </main>
    </div>
  );
}
