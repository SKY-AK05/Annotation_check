
import type { ManualEvaluationResult } from './types';

// Simple IoU (Intersection over Union) calculation for bounding boxes
function calculateIoU(boxA: number[], boxB: number[]): number {
    const [ax1, ay1, aw, ah] = boxA;
    const [bx1, by1, bw, bh] = boxB;
    const ax2 = ax1 + aw;
    const ay2 = ay1 + ah;
    const bx2 = bx1 + bw;
    const bh2 = by1 + bh;

    const x_left = Math.max(ax1, bx1);
    const y_top = Math.max(ay1, by1);
    const x_right = Math.min(ax2, bx2);
    const y_bottom = Math.min(ay2, bh2);

    if (x_right < x_left || y_bottom < y_top) {
        return 0.0;
    }

    const intersection_area = (x_right - x_left) * (y_bottom - y_top);
    const boxA_area = aw * ah;
    const boxB_area = bw * bh;
    const union_area = boxA_area + boxB_area - intersection_area;

    return intersection_area / union_area;
}


interface CocoAnnotation {
    id: number;
    image_id: number;
    category_id: number;
    bbox: [number, number, number, number]; // [x,y,width,height]
}

interface CocoImage {
    id: number;
    file_name: string;
}

interface CocoCategory {
    id: number;
    name: string;
}

interface CocoJson {
    images: CocoImage[];
    annotations: CocoAnnotation[];
    categories: CocoCategory[];
}

function getCategoryName(id: number, categories: CocoCategory[]): string {
    const category = categories.find(c => c.id === id);
    return category ? category.name : 'unknown';
}

export function evaluateAnnotations(gtJson: CocoJson, studentJson: CocoJson): ManualEvaluationResult {
    const IOU_THRESHOLD = 0.5;

    const gtAnnotations = gtJson.annotations;
    const studentAnnotations = studentJson.annotations;
    const categories = gtJson.categories;

    const matched: ManualEvaluationResult['matched'] = [];
    const missed: ManualEvaluationResult['missed'] = [];
    const extra: ManualEvaluationResult['extra'] = [];
    
    const studentMatchedIds = new Set<number>();
    const gtMatchedIds = new Set<number>();
    let totalIou = 0;
    
    for (const gt of gtAnnotations) {
        let bestMatch: { studentAnn: CocoAnnotation; iou: number } | null = null;
        for (const student of studentAnnotations) {
            if (studentMatchedIds.has(student.id)) continue;
            if (gt.image_id !== student.image_id) continue;

            const iou = calculateIoU(gt.bbox, student.bbox);
            if (iou > IOU_THRESHOLD) {
                if (!bestMatch || iou > bestMatch.iou) {
                   bestMatch = { studentAnn: student, iou };
                }
            }
        }
        
        if (bestMatch) {
            gtMatchedIds.add(gt.id);
            studentMatchedIds.add(bestMatch.studentAnn.id);

            const gtLabel = getCategoryName(gt.category_id, categories);
            const studentLabel = getCategoryName(bestMatch.studentAnn.category_id, studentJson.categories);
            
            matched.push({
                gt: gtLabel,
                student: studentLabel,
                iou: bestMatch.iou,
            });
            totalIou += bestMatch.iou;
        }
    }

    // Identify missed annotations
    for (const gt of gtAnnotations) {
        if (!gtMatchedIds.has(gt.id)) {
            missed.push({ gt: getCategoryName(gt.category_id, categories) });
        }
    }

    // Identify extra annotations
    for (const student of studentAnnotations) {
        if (!studentMatchedIds.has(student.id)) {
            extra.push({ student: getCategoryName(student.category_id, studentJson.categories) });
        }
    }

    const totalGt = gtAnnotations.length;
    const totalStudent = studentAnnotations.length;

    const correctLabelCount = matched.filter(m => m.gt === m.student).length;
    const label_accuracy = {
        correct: correctLabelCount,
        total: matched.length,
        accuracy: matched.length > 0 ? (correctLabelCount / matched.length) * 100 : 0,
    };

    const score = totalGt > 0 ? (correctLabelCount / totalGt) * 100 * 0.7 + (totalIou / totalGt) * 100 * 0.3 : 0;
    
    const feedback: string[] = [];
    if (missed.length > 0) feedback.push(`You missed ${missed.length} annotations.`);
    if (extra.length > 0) feedback.push(`You added ${extra.length} extra annotations.`);
    if (matched.length > 0) feedback.push(`You correctly matched ${matched.length} annotations.`);
    const mislabeledCount = matched.length - correctLabelCount;
    if (mislabeledCount > 0) feedback.push(`You mislabeled ${mislabeledCount} annotations.`);

    const critical_issues: string[] = [];
    if(missed.length > 0) critical_issues.push(`Missed annotations for: ${missed.map(m => m.gt).join(', ')}.`);
    if(extra.length > 0) critical_issues.push(`Found extra annotations for: ${extra.map(m => m.student).join(', ')}.`);
    
    return {
        source: 'manual',
        score: Math.round(score),
        feedback,
        matched,
        missed,
        extra,
        average_iou: matched.length > 0 ? totalIou / matched.length : 0,
        label_accuracy,
        critical_issues,
    };
}
