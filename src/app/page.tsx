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
      const gtAnnotationsText = await data.gtFile.text();
      const studentAnnotationsText = await data.studentFile.text();

      // Simulate parsing
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
        // Standard evaluation logic
        const mockSuccessResult: ManualEvaluationResult = {
          source: 'manual',
          score: Math.floor(70 + Math.random() * 25), // 70-95
          feedback: [
            "All annotations were successfully checked.",
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
        await new Promise(resolve => setTimeout(resolve, 1500));
        setResults(mockSuccessResult);
        toast({
          title: "Evaluation Complete",
          description: "Standard evaluation logic was successful.",
        });
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
