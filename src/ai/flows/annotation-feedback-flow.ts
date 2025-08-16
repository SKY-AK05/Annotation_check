
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
 * Compares GT and Student bounding boxes and determines if each edge
 * is a cut_off or gap. This is a direct translation of the correct Python logic.
 * @param gt - Ground Truth bounding box
 * @param student - Student bounding box
 * @returns A list of identified issues without human-readable messages.
 */
function checkAllEdges(gt: BboxAnnotation, student: BboxAnnotation): Omit<z.infer<typeof FeedbackIssueSchema>, 'message'>[] {
    const issues: Omit<z.infer<typeof FeedbackIssueSchema>, 'message'>[] = [];
    const [gt_x, gt_y, gt_w, gt_h] = gt.bbox;
    const [st_x, st_y, st_w, st_h] = student.bbox;

    // Top edge
    if (st_y < gt_y) {
        issues.push({ edge: "top", status: "cut_off" });
    } else if (st_y > gt_y) {
        issues.push({ edge: "top", status: "gap" });
    }

    // Bottom edge
    const gt_bottom = gt_y + gt_h;
    const st_bottom = st_y + st_h;
    if (st_bottom > gt_bottom) {
        issues.push({ edge: "bottom", status: "cut_off" });
    } else if (st_bottom < gt_bottom) {
        issues.push({ edge: "bottom", status: "gap" });
    }

    // Left edge
    if (st_x < gt_x) {
        issues.push({ edge: "left", status: "cut_off" });
    } else if (st_x > gt_x) {
        issues.push({ edge: "left", status: "gap" });
    }

    // Right edge
    const gt_right = gt_x + gt_w;
    const st_right = st_x + st_w;
    if (st_right > gt_right) {
        issues.push({ edge: "right", status: "cut_off" });
    } else if (st_right < gt_right) {
        issues.push({ edge: "right", status: "gap" });
    }
    
    // Add aligned status for edges with no issues if no other issues were found at all.
    // This simplifies the AI prompt by not cluttering it with "aligned" messages.
    if (issues.length === 0) {
        const allEdges: ('top' | 'bottom' | 'left' | 'right')[] = ['top', 'bottom', 'left', 'right'];
        allEdges.forEach(edge => {
            issues.push({ edge, status: 'aligned' });
        });
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
    
    const provisionalIssues = checkAllEdges(gt, student);

    const significantIssues = provisionalIssues.filter(issue => issue.status !== 'aligned');

    // Stage 2: AI-powered verification and message generation
    const prompt = `
      You are an expert annotation reviewer. Your task is to provide human-readable feedback based on a rule-based analysis.
      
      I have analyzed a student's bounding box against the ground truth. Here are the issues my rules detected:
      ${significantIssues.length > 0 ? JSON.stringify(significantIssues) : "No geometric issues were detected by the rules."}

      Please perform two tasks:
      1.  **Visually verify these findings** against the provided image ({{media url=imageBase64}}). Sometimes the rules are too strict. For example, a tiny 1-pixel 'gap' might be irrelevant. If no rule-based issues were found, perform your own visual check to see if the rules missed anything obvious (like a small part of the object being cut off).
      2.  For each *confirmed* issue, generate a concise, helpful, human-readable message. 
          - If the status is 'gap', the message should indicate that the box needs to be extended.
          - If the status is 'cut_off', the message should indicate the box is too large and needs to be shrunk.
      3.  If you look at the image and disagree with the rules, or if no issues were found and the annotation looks good, return an empty "issues" array.

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
          { "edge": "top", "status": "gap", "message": "There's a small gap at the top; the box should be moved up to include the roof." }
        ]
      }

      **Example for a perfectly aligned box:**
      {
        "feedbackId": "fb_67890",
        "issues": []
      }
    `;

    const llmResponse = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: [
        { text: prompt },
        { media: { url: input.imageBase64, contentType: 'image/jpeg' } },
      ],
      config: {
          responseMimeType: 'application/json',
      },
      output: { schema: FeedbackResponseSchema },
    });

    let aiOutput = llmResponse.output;

    if (!aiOutput) {
      throw new Error("AI model failed to provide a response.");
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
                issues: significantIssues.length > 0 ? significantIssues.map(issue => ({...issue, message: `Rule-based detection: ${issue.status} on ${issue.edge} edge.`})) : []
            };
        }
    }
    
    const validatedResponse = FeedbackResponseSchema.parse(aiOutput);

    // If the AI says it's aligned but rules found something significant, trust the rules as a fail-safe.
    // This handles cases where the AI might hallucinate alignment.
    if (validatedResponse.issues.length === 0 && significantIssues.length > 0) {
        return {
            feedbackId: validatedResponse.feedbackId || `override_${Date.now()}`,
            issues: significantIssues.map(issue => ({ ...issue, message: `Rule-based detection: A '${issue.status}' was found on the ${issue.edge} edge.` }))
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
        annotationId: input.student.id,
        ...response,
    };
}
