

import type { EvaluationResult, CocoJson, BboxAnnotation, LabelAccuracy, AttributeAccuracy, Match, ImageEvaluationResult } from './types';
import type { EvalSchema } from '@/ai/flows/extract-eval-schema';

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
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    return (maxLength - distance) / maxLength;
}

function getAnnotationAttribute(annotation: BboxAnnotation, key: string): string | undefined {
    return annotation.attributes?.[key];
}

export function evaluateAnnotations(gtJson: CocoJson, studentJson: CocoJson, schema: EvalSchema): Omit<EvaluationResult, 'studentFilename'> {
    const IOU_THRESHOLD = 0.5;
    const matchKey = schema.matchKey;

    const allGtAnnotations = gtJson.annotations || [];
    const allStudentAnnotations = studentJson.annotations || [];

    const gtCategories = new Map((gtJson.categories || []).map(c => [c.id, c.name]));
    const studentCategories = new Map((studentJson.categories || []).map(c => [c.id, c.name]));
    const gtImages = new Map((gtJson.images || []).map(i => [i.id, i.file_name]));

    const matched: Match[] = [];
    
    const studentMatchedIds = new Set<number>();
    const gtMatchedIds = new Set<number>();
    
    let totalIou = 0;
    let correctLabelCount = 0;
    let totalAttributeSimilaritySum = 0;
    let attributeComparisonsCount = 0;

    // Group annotations by image ID
    const gtAnnsByImage = allGtAnnotations.reduce((acc, ann) => {
        (acc[ann.image_id] = acc[ann.image_id] || []).push(ann);
        return acc;
    }, {} as Record<number, BboxAnnotation[]>);

    const studentAnnsByImage = allStudentAnnotations.reduce((acc, ann) => {
        (acc[ann.image_id] = acc[ann.image_id] || []).push(ann);
        return acc;
    }, {} as Record<number, BboxAnnotation[]>);
    
    const imageIds = Object.keys(gtAnnsByImage).map(Number);
    const image_results: ImageEvaluationResult[] = [];


    for (const imageId of imageIds) {
        const gtAnnotations = gtAnnsByImage[imageId] || [];
        const studentAnnotations = studentAnnsByImage[imageId] || [];
        const imageUsedStudentIds = new Set<number>();

        const imageMatched: Match[] = [];

        // First pass: Match using the unique key if it exists
        if (matchKey) {
            const studentMap = new Map<string, BboxAnnotation>();
            studentAnnotations.forEach(ann => {
                if (studentMatchedIds.has(ann.id)) return;
                const key = getAnnotationAttribute(ann, matchKey);
                if(key) studentMap.set(key, ann);
            });

            for (const gt of gtAnnotations) {
                if (gtMatchedIds.has(gt.id)) continue;
                const key = getAnnotationAttribute(gt, matchKey);
                if (key && studentMap.has(key)) {
                    const student = studentMap.get(key)!;
                    
                    gtMatchedIds.add(gt.id);
                    studentMatchedIds.add(student.id);
                    imageUsedStudentIds.add(student.id);

                    const iou = calculateIoU(gt.bbox, student.bbox);
                    totalIou += iou;

                    const gtLabel = gtCategories.get(gt.category_id);
                    const studentLabel = studentCategories.get(student.category_id);
                    const isLabelMatch = gtLabel === studentLabel;
                    if(isLabelMatch) correctLabelCount++;

                    let pairAttributeSimilarity = 0;
                    const labelSchema = schema.labels.find(l => l.name === gtLabel);
                    if (labelSchema && labelSchema.attributes.length > 0) {
                        let currentPairSimilaritySum = 0;
                        let currentPairAttributeCount = 0;
                        for (const attrName of labelSchema.attributes) {
                             if (attrName === matchKey || attrName === 'label') continue;
                            const gtAttr = getAnnotationAttribute(gt, attrName) || '';
                            const studentAttr = getAnnotationAttribute(student, attrName) || '';
                            currentPairSimilaritySum += getStringSimilarity(gtAttr, studentAttr);
                            currentPairAttributeCount++;
                        }
                        if (currentPairAttributeCount > 0) {
                            pairAttributeSimilarity = currentPairSimilaritySum / currentPairAttributeCount;
                            totalAttributeSimilaritySum += currentPairSimilaritySum;
                            attributeComparisonsCount += currentPairAttributeCount;
                        }
                    }

                    const matchResult = { gt, student, iou, isLabelMatch, attributeSimilarity: pairAttributeSimilarity };
                    matched.push(matchResult);
                    imageMatched.push(matchResult);
                    studentMap.delete(key);
                }
            }
        }
        
        // Second pass: Match remaining annotations using IoU + Label fallback
        for (const gt of gtAnnotations) {
            if (gtMatchedIds.has(gt.id)) continue;

            let bestMatch: { studentAnn: BboxAnnotation; iou: number } | null = null;
            for (const student of studentAnnotations) {
                if (studentMatchedIds.has(student.id) || imageUsedStudentIds.has(student.id)) continue;
                
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
                imageUsedStudentIds.add(bestMatch.studentAnn.id);
                
                totalIou += bestMatch.iou;

                const gtLabel = gtCategories.get(gt.category_id);
                const studentLabel = studentCategories.get(bestMatch.studentAnn.category_id);
                const isLabelMatch = gtLabel === studentLabel;
                if (isLabelMatch) correctLabelCount++;
                
                let pairAttributeSimilarity = 0;
                const labelSchema = schema.labels.find(l => l.name === gtLabel);

                if (labelSchema && labelSchema.attributes.length > 0) {
                    let currentPairSimilaritySum = 0;
                    let currentPairAttributeCount = 0;
                    for (const attrName of labelSchema.attributes) {
                        if (attrName === matchKey || attrName === 'label') continue;
                        const gtAttr = getAnnotationAttribute(gt, attrName) || '';
                        const studentAttr = getAnnotationAttribute(bestMatch.studentAnn, attrName) || '';
                        currentPairSimilaritySum += getStringSimilarity(gtAttr, studentAttr);
                        currentPairAttributeCount++;
                    }
                    if (currentPairAttributeCount > 0) {
                        pairAttributeSimilarity = currentPairSimilaritySum / currentPairAttributeCount;
                        totalAttributeSimilaritySum += currentPairSimilaritySum;
                        attributeComparisonsCount += currentPairAttributeCount;
                    }
                }
                const matchResult = { gt, student: bestMatch.studentAnn, iou: bestMatch.iou, isLabelMatch, attributeSimilarity: pairAttributeSimilarity };
                matched.push(matchResult);
                imageMatched.push(matchResult);
            }
        }
        
        const imageGtIds = new Set(gtAnnotations.map(a => a.id));
        const imageStudentIds = new Set(studentAnnotations.map(a => a.id));

        const imageMissed = gtAnnotations
            .filter(g => !gtMatchedIds.has(g.id))
            .map(gt => ({ gt }));

        const imageExtra = studentAnnotations
            .filter(s => !imageUsedStudentIds.has(s.id) && !studentMatchedIds.has(s.id))
            .map(student => ({ student }));
        
        if (imageMatched.length > 0 || imageMissed.length > 0 || imageExtra.length > 0) {
             image_results.push({
                imageId: imageId,
                imageName: gtImages.get(imageId) || `Image ID: ${imageId}`,
                matched: imageMatched,
                missed: imageMissed,
                extra: imageExtra,
            });
        }
    }


    const missed = allGtAnnotations
        .filter(g => !gtMatchedIds.has(g.id))
        .map(gt => ({ gt }));

    const extra = allStudentAnnotations
        .filter(s => !studentMatchedIds.has(s.id))
        .map(student => ({ student }));

    const totalGt = allGtAnnotations.length;
    const totalStudent = allStudentAnnotations.length;

    const label_accuracy: LabelAccuracy = {
        correct: correctLabelCount,
        total: matched.length,
        accuracy: matched.length > 0 ? (correctLabelCount / matched.length) * 100 : 0,
    };

    const attribute_accuracy: AttributeAccuracy = {
        average_similarity: attributeComparisonsCount > 0 ? (totalAttributeSimilaritySum / attributeComparisonsCount) * 100 : 100,
        total: attributeComparisonsCount,
    };

    const iouScore = matched.length > 0 ? (totalIou / matched.length) * 100 : 0;
    const precision = totalStudent > 0 ? matched.length / totalStudent : 0;
    const recall = totalGt > 0 ? matched.length / totalGt : 0;
    
    // Using F-beta score with beta=0.5 to weigh precision more than recall
    const fbetaScore = (precision > 0 || recall > 0) ? (1.25 * precision * recall) / (0.25 * precision + recall) * 100 : 0;

    const finalScore = (fbetaScore * 0.4) + (iouScore * 0.3) + (label_accuracy.accuracy * 0.2) + (attribute_accuracy.average_similarity * 0.1);
    
    const feedback: string[] = [];
    feedback.push(`Detected ${matched.length} out of ${totalGt} ground truth annotations.`);
    if (missed.length > 0) feedback.push(`You missed ${missed.length} annotations.`);
    if (extra.length > 0) feedback.push(`You added ${extra.length} extra annotations.`);
    const mislabeledCount = matched.length - correctLabelCount;
    if (mislabeledCount > 0) feedback.push(`You mislabeled ${mislabeledCount} annotations.`);
    feedback.push(`Average IoU for matched items is ${((matched.length > 0 ? totalIou / matched.length : 0) * 100).toFixed(1)}%.`);
    if(attributeComparisonsCount > 0) feedback.push(`Attribute text accuracy for matched items is ${attribute_accuracy.average_similarity.toFixed(1)}%.`);

    const critical_issues: string[] = [];
    if (recall < 0.5 && totalGt > 5) critical_issues.push(`High number of missed annotations (${missed.length}). Review the GT carefully.`);
    if (precision < 0.5 && totalStudent > 5) critical_issues.push(`High number of extra annotations (${extra.length}). Ensure you only annotate required objects.`);
    if(label_accuracy.accuracy < 70 && label_accuracy.total > 5) critical_issues.push(`Low label accuracy: ${label_accuracy.accuracy.toFixed(1)}%. Double-check object classes.`);
    if(attribute_accuracy.average_similarity < 70 && attribute_accuracy.total > 0) critical_issues.push(`Low attribute accuracy: ${attribute_accuracy.average_similarity.toFixed(1)}%. Check for typos or incorrect text.`);

    return {
        source: 'rule-based',
        score: Math.round(finalScore),
        feedback,
        matched,
        missed,
        extra,
        average_iou: matched.length > 0 ? totalIou / matched.length : 0,
        label_accuracy,
        attribute_accuracy,
        critical_issues,
        image_results,
    };
}
