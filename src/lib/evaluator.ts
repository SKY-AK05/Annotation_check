
import type { ManualEvaluationResult, CocoJson, BboxAnnotation, LabelAccuracy, AttributeAccuracy, Match } from './types';

// Simple IoU (Intersection over Union) calculation for bounding boxes
function calculateIoU(boxA: number[], boxB: number[]): number {
    const [ax1, ay1, aw, ah] = boxA;
    const [bx1, by1, bw, bh] = boxB;
    const ax2 = ax1 + aw;
    const ay2 = ay1 + ah;
    const bx2 = bx1 + bw;
    const b2y2 = by1 + bh;

    const x_left = Math.max(ax1, bx1);
    const y_top = Math.max(ay1, by1);
    const x_right = Math.min(ax2, bx2);
    const y_bottom = Math.min(ay2, b2y2);

    if (x_right < x_left || y_bottom < y_top) {
        return 0.0;
    }

    const intersection_area = (x_right - x_left) * (y_bottom - y_top);
    const boxA_area = aw * ah;
    const boxB_area = bw * bh;
    const union_area = boxA_area + boxB_area - intersection_area;

    return union_area > 0 ? intersection_area / union_area : 0;
}

// Levenshtein distance for string similarity
function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}


function getStringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;
    const distance = levenshteinDistance(str1, str2);
    return (maxLength - distance) / maxLength;
}


function getCategoryName(id: number, categories: {id: number, name: string}[]): string {
    const category = categories.find(c => c.id === id);
    return category ? category.name : 'unknown';
}

export function evaluateAnnotations(gtJson: CocoJson, studentJson: CocoJson): ManualEvaluationResult {
    const IOU_THRESHOLD = 0.5;

    const gtAnnotations = gtJson.annotations;
    const studentAnnotations = studentJson.annotations;

    const matched: Match[] = [];
    const missed: { gt: BboxAnnotation }[] = [];
    const extra: { student: BboxAnnotation }[] = [];
    
    const studentMatchedIds = new Set<number>();
    const gtMatchedIds = new Set<number>();
    
    let totalIou = 0;
    let correctLabelCount = 0;
    let totalAttributeSimilarity = 0;
    let attributeComparisons = 0;

    for (const gt of gtAnnotations) {
        let bestMatch: { studentAnn: BboxAnnotation; iou: number } | null = null;
        for (const student of studentAnnotations) {
            if (studentMatchedIds.has(student.id)) continue;
            if (gt.image_id !== student.image_id) continue;

            const iou = calculateIoU(gt.bbox, student.bbox);
            if (iou > IOU_THRESHOLD) {
                // Prioritize matching by category if multiple good IoUs exist
                if (!bestMatch || iou > bestMatch.iou || (gt.category_id === student.category_id && (!bestMatch || bestMatch.studentAnn.category_id !== gt.category_id))) {
                   bestMatch = { studentAnn: student, iou };
                }
            }
        }
        
        if (bestMatch) {
            gtMatchedIds.add(gt.id);
            studentMatchedIds.add(bestMatch.studentAnn.id);

            const gtLabel = getCategoryName(gt.category_id, gtJson.categories);
            const studentLabel = getCategoryName(bestMatch.studentAnn.category_id, studentJson.categories);
            
            const isLabelMatch = gtLabel === studentLabel;
            if(isLabelMatch) correctLabelCount++;

            let attributeSimilarity = 0;
            const gtAttribute = gt.attributes?.license_plate_number || '';
            const studentAttribute = bestMatch.studentAnn.attributes?.license_plate_number || '';

            if(gtAttribute || studentAttribute) {
                attributeSimilarity = getStringSimilarity(gtAttribute, studentAttribute);
                totalAttributeSimilarity += attributeSimilarity;
                attributeComparisons++;
            }

            matched.push({
                gt: { ...gt, label: gtLabel, attribute: gtAttribute },
                student: { ...bestMatch.studentAnn, label: studentLabel, attribute: studentAttribute },
                iou: bestMatch.iou,
                isLabelMatch,
                attributeSimilarity
            });
            totalIou += bestMatch.iou;
        } else {
            // Not matched, so it's a "miss"
            gtMatchedIds.add(gt.id);
            missed.push({ gt: { ...gt, label: getCategoryName(gt.category_id, gtJson.categories) } });
        }
    }

    // Identify extra annotations (student annotations that were not matched)
    for (const student of studentAnnotations) {
        if (!studentMatchedIds.has(student.id)) {
            extra.push({ student: { ...student, label: getCategoryName(student.category_id, studentJson.categories) } });
        }
    }

    const totalGt = gtAnnotations.length;
    const totalPossibleMatches = Math.max(totalGt, studentAnnotations.length);

    const label_accuracy: LabelAccuracy = {
        correct: correctLabelCount,
        total: matched.length,
        accuracy: matched.length > 0 ? (correctLabelCount / matched.length) * 100 : 0,
    };

    const attribute_accuracy: AttributeAccuracy = {
        average_similarity: attributeComparisons > 0 ? (totalAttributeSimilarity / attributeComparisons) * 100 : 0,
        total: attributeComparisons,
    }

    const iouScore = matched.length > 0 ? (totalIou / matched.length) * 100 : 0;
    const precision = totalPossibleMatches > 0 ? matched.length / studentAnnotations.length : 0;
    const recall = totalGt > 0 ? matched.length / totalGt : 0;
    const detectionScore = (precision * 0.4 + recall * 0.6) * 100;

    const finalScore = (detectionScore * 0.4) + (iouScore * 0.3) + (label_accuracy.accuracy * 0.2) + (attribute_accuracy.average_similarity * 0.1);
    
    const feedback: string[] = [];
    feedback.push(`Detected ${matched.length} of ${totalGt} ground truth annotations.`);
    if (missed.length > 0) feedback.push(`You missed ${missed.length} annotations.`);
    if (extra.length > 0) feedback.push(`You added ${extra.length} extra annotations that were not in the ground truth.`);
    const mislabeledCount = matched.length - correctLabelCount;
    if (mislabeledCount > 0) feedback.push(`You mislabeled ${mislabeledCount} annotations.`);
    feedback.push(`Average IoU for matched items is ${((matched.length > 0 ? totalIou / matched.length : 0) * 100).toFixed(1)}%.`);
    if(attributeComparisons > 0) feedback.push(`License plate text accuracy is ${attribute_accuracy.average_similarity.toFixed(1)}%.`);


    const critical_issues: string[] = [];
    if(missed.length > 5) critical_issues.push(`High number of missed annotations (${missed.length}).`);
    if(extra.length > 5) critical_issues.push(`High number of extra annotations (${extra.length}).`);
    if(label_accuracy.accuracy < 70 && label_accuracy.total > 0) critical_issues.push(`Low label accuracy: ${label_accuracy.accuracy.toFixed(1)}%`);
    if(attribute_accuracy.average_similarity < 70 && attribute_accuracy.total > 0) critical_issues.push(`Low attribute accuracy: ${attribute_accuracy.average_similarity.toFixed(1)}%`);

    return {
        source: 'manual',
        score: Math.round(finalScore),
        feedback,
        matched: matched.map(m => ({
            gt: m.gt.label,
            student: m.student.label,
            iou: m.iou,
        })),
        missed: missed.map(m => ({ gt: m.gt.label })),
        extra: extra.map(m => ({ student: m.student.label })),
        average_iou: matched.length > 0 ? totalIou / matched.length : 0,
        label_accuracy,
        attribute_accuracy,
        critical_issues,
        details: { matched, missed, extra }
    };
}
