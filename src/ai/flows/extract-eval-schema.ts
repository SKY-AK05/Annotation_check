
'use server';
/**
 * @fileOverview An AI flow for extracting the evaluation schema from a ground truth file.
 *
 * - extractEvalSchema - A function that analyzes a GT file and returns its schema.
 * - EvalSchemaInput - The input type for the extractEvalSchema function.
 * - EvalSchema - The return type for the extractEvalSchema function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

export const EvalSchemaInputSchema = z.object({
  gtFileContent: z
    .string()
    .describe('The full text content of the ground truth (GT) annotation file.'),
});
export type EvalSchemaInput = z.infer<typeof EvalSchemaInputSchema>;

export const EvalSchemaSchema = z.object({
    labels: z.array(z.object({
        name: z.string().describe("The name of the object class label, e.g., 'Person' or 'licence_plates'."),
        attributes: z.array(z.string()).describe("A list of attributes associated with this label, e.g., ['Mask', 'Age group']. If no attributes exist, return an empty array."),
    })).describe("A list of all unique object labels found in the ground truth file and their associated attributes."),
    matchKey: z.string().optional().describe("The specific attribute name that should be used as a unique key to match annotations between the GT and student files. This is often 'Annotation No' or a similar unique identifier. If no clear key exists, this can be omitted."),
    pseudoCode: z.string().describe("Human-readable pseudocode that summarizes the evaluation logic derived from the ground truth file schema. This should be editable by a user to adjust the evaluation logic."),
});
export type EvalSchema = z.infer<typeof EvalSchemaSchema>;

export async function extractEvalSchema(input: EvalSchemaInput): Promise<EvalSchema> {
  return extractEvalSchemaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractEvalSchemaPrompt',
  input: {schema: EvalSchemaInputSchema},
  output: {schema: EvalSchemaSchema},
  prompt: `You are an expert at analyzing annotation files (like COCO JSON or CVAT XML) to determine how they should be evaluated for a temporary student assessment.
Analyze the provided ground truth file content and extract the evaluation schema.

Based on the content, perform the following steps:
1.  Identify all unique object class labels.
2.  For each label, list the attributes associated with it. If a label has no attributes besides its bounding box, return an empty array for its attributes.
3.  Determine if there is a specific attribute that can serve as a unique key for matching annotations (e.g., "Annotation No", "track_id"). If found, specify it as the matchKey. If not, omit the field.
4.  Generate simple, human-readable Python-like pseudocode that describes the steps to evaluate a student's file against this GT. This pseudocode will be shown to a user and should be understandable. For example, if a label 'car' has an attribute 'license_plate_number', the pseudocode should suggest checking for a text match on that attribute. If a label has no attributes, it should only mention IoU evaluation.

This entire process is for the purpose of a temporary student evaluation ('evaluate_student_annotations') and the logic should be derived solely from the file provided.

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
