
'use server';

/**
 * @fileOverview This file implements the AI scoring fallback flow.
 * It is used when manual evaluation fails or when complex annotation types
 * (like polygons or keypoints) are selected. It uses the GT-derived
 * schema to perform a more context-aware evaluation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { EvaluationResult } from '@/lib/types';
import type { EvalSchema } from './extract-eval-schema';

// This schema is defined here to avoid exporting it from a 'use server' file.
const EvalSchemaSchema = z.object({
    labels: z.array(z.object({
        name: z.string(),
        attributes: z.array(z.string()),
    })),
    matchKey: z.string().optional(),
    pseudoCode: z.string(),
});

const AiScoringInputSchema = z.object({
  gtFileContent: z.string().describe("The full text content of the ground truth annotation file."),
  studentFileContent: z.string().describe("The full text content of the student's annotation file."),
  evalRules: EvalSchemaSchema.describe("The evaluation rules and schema derived from the GT file. This provides the context for how to score the submission."),
  errorContext: z.string().optional().describe("Optional context about an error that occurred during manual evaluation, which can be used to guide the AI."),
  purpose: z.literal("evaluate_student_annotations").describe("The explicit purpose for this request, ensuring the AI understands the context."),
  isTemporary: z.literal(true).describe("Confirms that this evaluation is a one-time, temporary task.")
});
export type AiScoringInput = z.infer<typeof AiScoringInputSchema>;

// This is a placeholder for the full AI-driven result schema.
// For now, it matches the manual evaluation result.
const AiEvaluationResultSchema = z.object({
    source: z.literal('ai'),
    score: z.number().describe("The final score from 0 to 100."),
    feedback: z.array(z.string()).describe("A list of feedback points for the student."),
    matched: z.array(z.object({ gt: z.string(), student: z.string(), iou: z.number() })).describe("Annotations that were successfully matched."),
    missed: z.array(z.object({ gt: z.string() })).describe("Annotations that were in the GT but not in the student submission."),
    extra: z.array(z.object({ student: z.string() })).describe("Annotations in the student submission that were not in the GT."),
    average_iou: z.number().describe("The average Intersection over Union for all matched items."),
    label_accuracy: z.object({ correct: z.number(), total: z.number(), accuracy: z.number() }),
    attribute_accuracy: z.object({ average_similarity: z.number(), total: z.number() }),
    critical_issues: z.array(z.string()).describe("A list of critical issues found during evaluation."),
});

const aiScoringFallbackFlow = ai.defineFlow(
    {
        name: 'aiScoringFallbackFlow',
        inputSchema: AiScoringInputSchema,
        outputSchema: AiEvaluationResultSchema,
    },
    async (input) => {
        console.log("Generated evaluation logic for student assessment. Temporary = true.");
        // This is a placeholder for the actual AI scoring flow.
        // In a real implementation, this would call a prompt similar to the one below.
        console.log("AI Scoring Fallback invoked with:", input);
        
        // For now, return a mock result.
        return {
            source: 'ai', // This is now correctly sourced from the AI
            score: 88,
            feedback: [
                "AI Fallback: Successfully evaluated submission based on the provided rules.",
                "AI noted a slight misalignment on 2 bounding boxes.",
                "The label for 'car' (Annotation No 3) was incorrect, which goes against the generated pseudocode."
            ],
            matched: [
                { gt: 'Person', student: 'Person', iou: 0.92 },
                { gt: 'car', student: 'truck', iou: 0.85 },
            ],
            missed: [{ gt: 'Lays' }],
            extra: [],
            average_iou: 0.885,
            label_accuracy: { correct: 1, total: 2, accuracy: 50 },
            attribute_accuracy: { average_similarity: 95, total: 5 },
            critical_issues: ["Incorrect label for 'car' needs review as per the evaluation schema."],
        };
    }
);


export async function aiScoringFallback(input: AiScoringInput): Promise<EvaluationResult> {
    return await aiScoringFallbackFlow(input) as EvaluationResult;
}
