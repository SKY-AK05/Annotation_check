
'use server';
/**
 * @fileOverview An AI flow for extracting the evaluation schema from a ground truth file.
 *
 * - extractEvalSchema - A function that analyzes a GT file and returns its schema.
 * - EvalSchemaInput - The input type for the extractEvalSchema function.
 * - EvalSchema - The return type for the extractEvalSchema function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit/zod';

export const EvalSchemaInputSchema = z.object({
  gtFileContent: z
    .string()
    .describe('The full text content of the ground truth (GT) annotation file.'),
});
export type EvalSchemaInput = z.infer<typeof EvalSchemaInputSchema>;

export const EvalSchemaSchema = z.object({
    labels: z.array(z.object({
        name: z.string().describe("The name of the object class label, e.g., 'Person' or 'licence_plates'."),
        attributes: z.array(z.string()).describe("A list of attributes associated with this label, e.g., ['Mask', 'Age group']."),
    })).describe("A list of all unique object labels found in the ground truth file and their associated attributes."),
    matchKey: z.string().describe("The specific attribute name that should be used as a unique key to match annotations between the GT and student files. This is often 'Annotation No' or a similar unique identifier."),
    pseudoCode: z.string().describe("Human-readable pseudocode that summarizes the evaluation logic derived from the ground truth file schema."),
});
export type EvalSchema = z.infer<typeof EvalSchemaSchema>;

export async function extractEvalSchema(input: EvalSchemaInput): Promise<EvalSchema> {
  return extractEvalSchemaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractEvalSchemaPrompt',
  input: {schema: EvalSchemaInputSchema},
  output: {schema: EvalSchemaSchema},
  prompt: `You are an expert at analyzing annotation files (like COCO JSON or CVAT XML) to determine how they should be evaluated.
Analyze the provided ground truth file content and extract the evaluation schema.

Based on the content, identify all unique labels and the attributes associated with each.
Determine the attribute that serves as the unique key for matching annotations (e.g., "Annotation No").
Finally, generate simple, human-readable pseudocode that describes the steps to evaluate a student's file against this GT.

Ground Truth File Content:
{{{gtFileContent}}}
`,
});

const extractEvalSchemaFlow = ai.defineFlow(
  {
    name: 'extractEvalSchemaFlow',
    inputSchema: EvalSchemaInputSchema,
    outputSchema: EvalSchemaSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("The AI model failed to extract an evaluation schema. The GT file might be malformed or empty.");
    }
    return output;
  }
);
