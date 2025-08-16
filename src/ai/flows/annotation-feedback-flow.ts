
'use server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BboxAnnotation, Feedback, FeedbackInput } from '@/lib/types';

// Define Zod schemas for structured input and output
const FeedbackIssueSchema = z.object({
  edge: z.enum(['top', 'bottom', 'left', 'right']),
  status: z.enum(['gap', 'cut_off', 'aligned']),
  message: z.string().describe('A human-readable message explaining the issue.'),
});

const FeedbackResponseSchema = z.object({
  feedbackId: z.string().describe('A unique ID for this feedback response.'),
  issues: z.array(FeedbackIssueSchema).describe('A list of identified issues for the annotation.'),
});

const FeedbackInputSchema = z.object({
  gt: z.any().describe('The ground truth bounding box annotation.'),
  student: z.any().describe('The student bounding box annotation.'),
  imageBase64: z.string().describe('The base64 encoded image data.'),
});

/**
 * Checks a single edge of the bounding box.
 * @param gtVal - The ground truth coordinate for the edge.
 * @param stVal - The student coordinate for the edge.
 * @param threshold - The tolerance for alignment.
 * @returns 'gap', 'cut_off', or 'aligned'.
 */
function checkEdge(gtVal: number, stVal: number, threshold: number): 'gap' | 'cut_off' | 'aligned' {
  const diff = stVal - gtVal;
  if (Math.abs(diff) <= threshold) {
    return 'aligned';
  }
  // If student coordinate is "smaller" (top/left) or "larger" (right/bottom in terms of position)
  // it indicates a gap or cut-off differently based on the edge.
  // This logic is simplified and might need adjustment based on coordinate system (e.g. y-axis direction)
  if (diff > 0) {
    return 'gap'; // e.g., student's top edge is below GT's top edge
  } else {
    return 'cut_off'; // e.g., student's top edge is above GT's top edge
  }
}

/**
 * A more robust checkEdge function that handles each edge explicitly.
 * @param gt - Ground Truth bounding box
 * @param student - Student bounding box
 * @param threshold - Tolerance for alignment
 * @returns A list of identified issues.
 */
function checkAllEdges(gt: BboxAnnotation, student: BboxAnnotation, threshold: number) {
  const issues: z.infer<typeof FeedbackIssueSchema>[] = [];
  const gtRight = gt.bbox[0] + gt.bbox[2];
  const stRight = student.bbox[0] + student.bbox[2];
  const gtBottom = gt.bbox[1] + gt.bbox[3];
  const stBottom = student.bbox[1] + student.bbox[3];

  // Top Edge
  if (student.bbox[1] > gt.bbox[1] + threshold) {
    issues.push({ edge: 'top', status: 'gap', message: 'Top edge has a gap.' });
  } else if (student.bbox[1] < gt.bbox[1] - threshold) {
    issues.push({ edge: 'top', status: 'cut_off', message: 'Top edge is cut off.' });
  }

  // Bottom Edge
  if (stBottom < gtBottom - threshold) {
    issues.push({ edge: 'bottom', status: 'gap', message: 'Bottom edge has a gap.' });
  } else if (stBottom > gtBottom + threshold) {
    issues.push({ edge: 'bottom', status: 'cut_off', message: 'Bottom edge is cut off.' });
  }

  // Left Edge
  if (student.bbox[0] > gt.bbox[0] + threshold) {
    issues.push({ edge: 'left', status: 'gap', message: 'Left edge has a gap.' });
  } else if (student.bbox[0] < gt.bbox[0] - threshold) {
    issues.push({ edge: 'left', status: 'cut_off', message: 'Left edge is cut off.' });
  }

  // Right Edge
  if (stRight < gtRight - threshold) {
    issues.push({ edge: 'right', status: 'gap', message: 'Right edge has a gap.' });
  } else if (stRight > gtRight + threshold) {
    issues.push({ edge: 'right', status: 'cut_off', message: 'Right edge is cut off.' });
  }

  return issues;
}


// Define the Genkit flow with Zod schemas for validation
const getAnnotationFeedbackFlow = ai.defineFlow(
  {
    name: 'getAnnotationFeedbackFlow',
    inputSchema: FeedbackInputSchema,
    outputSchema: FeedbackResponseSchema,
  },
  async (input) => {
    // Stage 1: Rule-based geometric check
    const gt = input.gt as BboxAnnotation;
    const student = input.student as BboxAnnotation;

    // Use a dynamic threshold, e.g., 2% of the GT box's smaller dimension
    const threshold = Math.min(gt.bbox[2], gt.bbox[3]) * 0.05;
    
    const provisionalIssues = checkAllEdges(gt, student, threshold);

    const significantIssues = provisionalIssues.filter(issue => issue.status !== 'aligned');

    // If rules find no significant issues, still run AI verification
    // to catch cases the rules might miss (semantic issues, etc.).
    
    // Stage 2: AI-powered verification and message generation
    const prompt = `
      You are an expert annotation reviewer.
      A user has annotated an object. I have performed a preliminary rule-based check and found the following potential issues:
      ${significantIssues.length > 0 ? JSON.stringify(significantIssues) : "No geometric issues were detected by the rules."}

      Your task is to:
      1.  Look at the provided image ({{media url=imageBase64}}).
      2.  Analyze the ground truth bounding box (approximated by coordinates) and the student's bounding box.
      3.  **Verify the rule-based findings.** If the rules flagged an issue (e.g., a "gap"), confirm if it's a real issue in the image context. If the rules found nothing, perform your own visual check.
      4.  **Generate human-readable feedback.** For each confirmed issue, create a concise, helpful message. If there are no issues, confirm that the annotation is well-aligned.

      **CRITICAL:** Your entire response must be a single, valid JSON object that conforms to the following Zod schema. Do not include any explanatory text, Markdown formatting, or anything outside of the JSON object.

      **Required JSON Output Format:**
      {
        "feedbackId": "<a unique string>",
        "issues": [
          {
            "edge": "top" | "bottom" | "left" | "right",
            "status": "gap" | "cut_off" | "aligned",
            "message": "<Your helpful, human-readable message for this specific edge>"
          }
        ]
      }

      **Example for a car annotation with a gap at the top:**
      {
        "feedbackId": "fb_12345",
        "issues": [
          { "edge": "top", "status": "gap", "message": "The box is slightly too low, leaving a gap at the top of the car." }
        ]
      }

      **Example for a perfectly aligned box:**
      {
        "feedbackId": "fb_67890",
        "issues": []
      }
    `;

    // The AI call now includes the image and the provisional findings for context
    const llmResponse = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: [
        { text: prompt },
        { media: { url: input.imageBase64, contentType: 'image/jpeg' } },
      ],
      config: {
          response_format: 'json',
      },
      output: { schema: FeedbackResponseSchema },
    });

    let aiOutput = llmResponse.output;

    if (!aiOutput) {
        // Fallback if AI provides no output
        if (significantIssues.length > 0) {
            return {
                feedbackId: `fallback_${Date.now()}`,
                issues: significantIssues.map(issue => ({ ...issue, message: `Rule-based detection: ${issue.status} on ${issue.edge} edge.` }))
            };
        } else {
             return {
                feedbackId: `fallback_aligned_${Date.now()}`,
                issues: []
            };
        }
    }
    
    // The response should already be parsed because of the output schema, but as a safeguard:
    if (typeof aiOutput === 'string') {
        try {
            // Aggressively clean the string to find the JSON object
            const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                aiOutput = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("No JSON object found in the AI response.");
            }
        } catch (e: any) {
            console.error("AI returned malformed JSON, using rule-based fallback.", e);
            // Provide rule-based feedback as a fallback
            return {
                feedbackId: `fallback_error_${Date.now()}`,
                issues: significantIssues.length > 0 ? significantIssues : []
            };
        }
    }
    
    const validatedResponse = FeedbackResponseSchema.parse(aiOutput);

    // If the AI says it's aligned but rules found something, trust the rules as a fail-safe.
    // This handles cases where the AI might hallucinate alignment.
    if (validatedResponse.issues.length === 0 && significantIssues.length > 0) {
        return {
            feedbackId: validatedResponse.feedbackId || `override_${Date.now()}`,
            issues: significantIssues.map(issue => ({ ...issue, message: `Rule-based detection: ${issue.status} on ${issue.edge} edge.` }))
        };
    }

    return validatedResponse;
  }
);


// Export a wrapper function to be used by the frontend
export async function getAnnotationFeedback(input: FeedbackInput): Promise<Feedback> {
    const response = await getAnnotationFeedbackFlow({
        gt: input.gt,
        student: input.student,
        imageBase64: input.imageBase64,
    });
    return {
        annotationId: input.student.id, // Or GT id, depending on your needs
        ...response,
    };
}
