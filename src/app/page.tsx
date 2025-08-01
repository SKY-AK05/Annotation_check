
'use client';

import { useState } from 'react';
import type { FormValues } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { EvaluationForm } from '@/components/EvaluationForm';
import { ResultsDashboard } from '@/components/ResultsDashboard';
import { AnnotatorAiLogo } from '@/components/AnnotatorAiLogo';
import { aiScoringFallback, type AiScoringFallbackInput } from '@/ai/flows/ai-scoring-fallback';
import type { EvaluationResult } from '@/lib/types';
import { evaluateAnnotations } from '@/lib/evaluator';


export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<EvaluationResult | null>(null);
  const { toast } = useToast();

  const handleEvaluate = async (data: FormValues) => {
    setIsLoading(true);
    setResults(null);
  
    try {
      const gtAnnotationsText = await data.gtFile.text();
      const studentAnnotationsText = await data.studentFile.text();

      if (data.toolType === 'polygon') {
        toast({
          title: "Using AI Fallback",
          description: "Polygon evaluation is not yet implemented. Using AI-assisted scoring.",
          variant: "default",
        });
        const aiInput: AiScoringFallbackInput = {
          gtAnnotations: gtAnnotationsText,
          studentAnnotations: studentAnnotationsText,
          toolType: data.toolType,
          errorDetails: "Manual evaluation for polygons is not yet implemented."
        };
        const aiResult = await aiScoringFallback(aiInput);
        setResults({ ...aiResult, source: 'ai_fallback' });
        setIsLoading(false);
        return;
      }


      let gtAnnotations, studentAnnotations;
      try {
        gtAnnotations = JSON.parse(gtAnnotationsText);
        studentAnnotations = JSON.parse(studentAnnotationsText);
      } catch (e) {
        toast({
          title: "JSON Parsing Error",
          description: "One of the files is not valid JSON. Using AI to attempt evaluation.",
          variant: "default",
        });

        const aiInput: AiScoringFallbackInput = {
          gtAnnotations: gtAnnotationsText,
          studentAnnotations: studentAnnotationsText,
          toolType: data.toolType,
          errorDetails: `Failed to parse JSON: ${(e as Error).message}`
        };
        const aiResult = await aiScoringFallback(aiInput);
        setResults({ ...aiResult, source: 'ai_fallback' });
        setIsLoading(false);
        return;
      }

      // Simulate a structured error that would trigger the AI fallback
      if (data.toolType === 'keypoints' && studentAnnotations?.unsupported_keypoint_format) {
         toast({
          title: "Using AI Fallback",
          description: "Unsupported keypoint format. Using AI-assisted scoring.",
          variant: "default",
        });
  
        const aiInput: AiScoringFallbackInput = {
          gtAnnotations: gtAnnotationsText,
          studentAnnotations: studentAnnotationsText,
          toolType: data.toolType,
          errorDetails: "Traceback: \n File 'evaluator.py', line 152, in 'calculate_oks' \n UnsupportedKeypointFormatError: Student annotations use an outdated keypoint format."
        };
        
        const aiResult = await aiScoringFallback(aiInput);
        setResults({ ...aiResult, source: 'ai_fallback' });
      } else {
        // Standard evaluation logic using the new evaluator
        const manualResult = evaluateAnnotations(gtAnnotations, studentAnnotations);
        setResults(manualResult);
        toast({
          title: "Evaluation Complete",
          description: "Standard evaluation logic was successful.",
        });
      }
    } catch (e) {
      console.error(e);
      const error = e as Error;
      toast({
        title: "Error",
        description: `An unexpected error occurred: ${error.message}. Trying AI fallback.`,
        variant: "destructive",
      });
      // AI fallback on unexpected error
      try {
        const gtAnnotationsText = await data.gtFile.text();
        const studentAnnotationsText = await data.studentFile.text();
        const aiInput: AiScoringFallbackInput = {
          gtAnnotations: gtAnnotationsText,
          studentAnnotations: studentAnnotationsText,
          toolType: data.toolType,
          errorDetails: `An unexpected error occurred during evaluation: ${error.stack}`
        };
        const aiResult = await aiScoringFallback(aiInput);
        setResults({ ...aiResult, source: 'ai_fallback' });
      } catch (aiError) {
        console.error("AI Fallback failed:", aiError);
        toast({
          title: "AI Fallback Failed",
          description: "The AI fallback also failed to process the request.",
          variant: "destructive",
        });
      }
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
