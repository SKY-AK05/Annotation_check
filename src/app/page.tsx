'use client';

import { useState } from 'react';
import type { FormValues } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { EvaluationForm } from '@/components/EvaluationForm';
import { ResultsDashboard } from '@/components/ResultsDashboard';
import { AnnotatorAiLogo } from '@/components/AnnotatorAiLogo';
import { aiScoringFallback, type AiScoringFallbackInput } from '@/ai/flows/ai-scoring-fallback';
import type { EvaluationResult, ManualEvaluationResult, AiEvaluationResult } from '@/lib/types';


export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<EvaluationResult | null>(null);
  const { toast } = useToast();

  const handleEvaluate = async (data: FormValues) => {
    setIsLoading(true);
    setResults(null);
  
    try {
      const gtAnnotations = await data.gtFile.text();
      const studentAnnotations = await data.studentFile.text();

      await new Promise(resolve => setTimeout(resolve, 2000));
  
      if (Math.random() > 0.4) { // 60% chance of standard evaluation success
        const mockSuccessResult: ManualEvaluationResult = {
          source: 'manual',
          score: Math.floor(70 + Math.random() * 25), // 70-95
          feedback: [
            "Bounding box for 'cat' is well-aligned. IoU: 0.92.",
            "Bounding box for 'dog' is slightly off. IoU: 0.75.",
            "Student successfully identified all critical objects in the frame."
          ],
          matched: [
            { gt: "cat", student: "cat", iou: 0.92 },
            { gt: "dog", student: "dog", iou: 0.75 },
            { gt: "person", student: "person", iou: 0.88 },
          ],
          missed: [ { gt: "bicycle" } ],
          extra: [{ student: "bird" }],
          average_iou: 0.85,
          label_accuracy: { correct: 3, total: 4, accuracy: 75 },
          critical_issues: ["Extra annotation 'bird' was found that was not in the ground truth."]
        };
        setResults(mockSuccessResult);
        toast({
          title: "Evaluation Complete",
          description: "Standard evaluation logic was successful.",
        });
      } else { // 40% chance of AI fallback
        toast({
          title: "Using AI Fallback",
          description: "Primary evaluation failed. Using AI-assisted scoring.",
          variant: "default",
        });
  
        const aiInput: AiScoringFallbackInput = {
          gtAnnotations,
          studentAnnotations,
          toolType: data.toolType,
          errorDetails: "Traceback: \n File 'evaluator.py', line 52, in 'calculate_iou' \n KeyError: 'bbox'"
        };
        
        const aiResult = await aiScoringFallback(aiInput);
        
        const resultWithSource: AiEvaluationResult = {
          ...aiResult,
          source: 'ai_fallback'
        };
        setResults(resultWithSource);
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "An unexpected error occurred during evaluation.",
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
