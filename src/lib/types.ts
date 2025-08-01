import type { AiScoringFallbackOutput } from '@/ai/flows/ai-scoring-fallback';

export interface FormValues {
  gtFile: File;
  studentFile: File;
  toolType: string;
}

export interface ManualEvaluationResult {
  source: 'manual';
  score: number;
  feedback: string[];
  matched: { gt: string; student: string; iou: number }[];
  missed: { gt: string }[];
  extra: { student: string }[];
  average_iou: number;
  label_accuracy: { correct: number; total: number; accuracy: number };
  critical_issues: string[];
}

export interface AiEvaluationResult extends AiScoringFallbackOutput {
  source: 'ai_fallback';
}

export type EvaluationResult = ManualEvaluationResult | AiEvaluationResult;
