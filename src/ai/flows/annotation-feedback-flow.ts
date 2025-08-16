
'use server';
import type { BboxAnnotation, Feedback, FeedbackIssue } from '@/lib/types';


/**
 * Compares GT and Student bounding boxes and determines if each edge
 * is a cut_off or gap.
 * @param gt - Ground Truth bounding box
 * @param student - Student bounding box
 * @returns A list of identified issues without human-readable messages.
 */
function checkAllEdges(gt_bbox: number[], student_bbox: number[]): Omit<FeedbackIssue, 'message'>[] {
    const [gt_x, gt_y, gt_w, gt_h] = gt_bbox;
    const [st_x, st_y, st_w, st_h] = student_bbox;
    const issues: Omit<FeedbackIssue, 'message'>[] = [];

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
        issues.push({ edge: "left", "status": "cut_off" });
    } else if (st_x > gt_x) {
        issues.push({ edge: "left", "status": "gap" });
    }

    // Right edge
    const gt_right = gt_x + gt_w;
    const st_right = st_x + st_w;
    if (st_right > gt_right) {
        issues.push({ edge: "right", "status": "cut_off" });
    } else if (st_right < gt_right) {
        issues.push({ edge: "right", "status": "gap" });
    }
    
    return issues;
}


/**
 * Generates a human-readable feedback message based on a single issue.
 * @param issue - The geometric issue detected.
 * @returns A formatted string message.
 */
function generateRuleBasedMessage(issue: Omit<FeedbackIssue, 'message'>): string {
  if (issue.status === 'gap') {
    return `There is a gap on the ${issue.edge} edge. The box needs to be extended.`;
  }
  if (issue.status === 'cut_off') {
    return `The ${issue.edge} edge is cut off. The box is too large and needs to be shrunk.`;
  }
  return 'The annotation is well-aligned.';
}


/**
 * Analyzes bounding box differences and returns structured, rule-based feedback.
 * This function does NOT use an AI model.
 * @param input - The GT and Student annotations.
 * @returns A Feedback object with templated messages.
 */
export async function getAnnotationFeedback(input: { gt: BboxAnnotation; student: BboxAnnotation }): Promise<Feedback> {
    const provisionalIssues = checkAllEdges(input.gt.bbox, input.student.bbox);

    const issues: FeedbackIssue[] = provisionalIssues.map(issue => ({
        ...issue,
        message: generateRuleBasedMessage(issue),
    }));
    
    // Filter out 'aligned' messages if there are other significant issues.
    const significantIssues = issues.filter(issue => issue.status !== 'aligned');

    if (issues.length > 0 && significantIssues.length === 0) {
      return {
        annotationId: input.student.id,
        feedbackId: `rule_${Date.now()}`,
        issues: [{ edge: 'top', status: 'aligned', message: 'Annotation is well-aligned.' }], // top is arbitrary
      }
    }

    return {
        annotationId: input.student.id,
        feedbackId: `rule_${Date.now()}`,
        issues: significantIssues,
    };
}
