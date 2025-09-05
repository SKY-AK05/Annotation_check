
import type { EvaluationResult, CocoJson, BboxAnnotation, LabelAccuracy, AttributeAccuracy, Match, ImageEvaluationResult, SkeletonEvaluationResult, PolygonAnnotation, ScoreOverrides, AttributeScoreDetail, ScoringWeights, EvalSchema } from './types';
import munkres from 'munkres-js';


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

function getAnnotationAttribute(annotation: BboxAnnotation | PolygonAnnotation, key: string): string | undefined {
    return annotation.attributes?.[key];
}

function findOptimalMatches(
    gtAnns: BboxAnnotation[],
    studentAnns: BboxAnnotation[],
    iouThreshold: number
): { gtIndex: number; studentIndex: number; iou: number }[] {
    if (!gtAnns.length || !studentAnns.length) {
        return [];
    }

    const costMatrix = gtAnns.map(gt =>
        studentAnns.map(student => {
            const iou = calculateIoU(gt.bbox, student.bbox);
            // Cost is 1 - IoU. Lower cost is better. High cost for pairs below threshold.
            return iou >= iouThreshold ? 1 - iou : 1_000_000;
        })
    );

    const assignments = munkres(costMatrix) as [number, number][];

    const matches: { gtIndex: number; studentIndex: number; iou: number }[] = [];
    for (const [gtIndex, studentIndex] of assignments) {
        const cost = costMatrix[gtIndex][studentIndex];
        if (cost < 1_000_000) {
            matches.push({
                gtIndex,
                studentIndex,
                iou: 1 - cost,
            });
        }
    }
    return matches;
}


// This function now calculates the "Quality" score for a single match
function calculateMatchQuality(iou: number, labelSimilarity: number, attributeSimilarity: number, weights: ScoringWeights): number {
    const iouScore = iou * 100;
    const labelScore = labelSimilarity * 100;
    const attrScore = attributeSimilarity * 100;
    
    const totalWeight = weights.iou + weights.label + weights.attribute;
    if (totalWeight === 0) return 100; // Avoid division by zero, assume perfect if all weights are zero

    const weightedScore = 
        (iouScore * weights.iou) + 
        (labelScore * weights.label) + 
        (attrScore * weights.attribute);

    return weightedScore / totalWeight;
}


export function recalculateOverallScore(results: EvaluationResult, overrides: ScoreOverrides, schema: EvalSchema): EvaluationResult {
    const studentOverrides = overrides[results.studentFilename] || {};
    const weights = schema.weights || { quality: 90, completeness: 10, iou: 50, label: 25, attribute: 25 };
    
    // Deep clone to avoid direct state mutation
    const newResults = JSON.parse(JSON.stringify(results)) as EvaluationResult;
    
    newResults.image_results.forEach(ir => {
        ir.matched.forEach(match => {
            // Recalculate original score based on current weights first
            match.originalScore = calculateMatchQuality(match.iou, match.labelSimilarity, match.attributeSimilarity, weights);

            const override = studentOverrides[ir.imageId]?.[match.gt.id];
            if (override !== undefined && override !== null) {
                match.overrideScore = override;
            } else {
                match.overrideScore = null; // Ensure it's reset if override is removed
            }
        });
    });

    const allMatches = newResults.image_results.flatMap(ir => ir.matched);
    const averageQuality = allMatches.length > 0
        ? allMatches.reduce((sum, match) => sum + (match.overrideScore ?? match.originalScore), 0) / allMatches.length
        : 100; // Default to 100 if no matches to avoid penalizing empty images

    const matchedCount = allMatches.length;
    const missedCount = newResults.missed.length;
    const extraCount = newResults.extra.length;

    const totalGtAnnotations = matchedCount + missedCount;
    const totalStudentAnnotations = matchedCount + extraCount;
    
    const precision = totalStudentAnnotations > 0 ? matchedCount / totalStudentAnnotations : 0;
    const recall = totalGtAnnotations > 0 ? matchedCount / totalGtAnnotations : 0;
    
    const beta = 0.5;
    const fbetaScore = (precision > 0 || recall > 0)
        ? (1 + beta**2) * (precision * recall) / ((beta**2 * precision) + recall)
        : 0;

    const completenessScore = fbetaScore * 100;
    
    const totalWeight = weights.quality + weights.completeness;
    if (totalWeight === 0) {
        newResults.score = 100; // Or some other default, if all weights are 0
    } else {
        const weightedScore = (averageQuality * weights.quality) + (completenessScore * weights.completeness);
        newResults.score = Math.round(weightedScore / totalWeight);
    }
    
    return newResults;
}


export function evaluateAnnotations(gtJson: CocoJson, schema: EvalSchema, studentJson: CocoJson): Omit<EvaluationResult, 'studentFilename'> {
    const IOU_THRESHOLD = 0.5;
    const matchKey = schema.matchKey;
    const weights = schema.weights || { quality: 90, completeness: 10, iou: 50, label: 25, attribute: 25 };

    const allGtAnnotations = gtJson.annotations as BboxAnnotation[];
    const allStudentAnnotations = studentJson.annotations as BboxAnnotation[];

    const gtCategories = new Map((gtJson.categories || []).map(c => [c.id, c.name]));
    const studentCategories = new Map((studentJson.categories || []).map(c => [c.id, c.name]));
    const gtImages = new Map((gtJson.images || []).map(i => [i.id, i.file_name.split('/').pop()!]));

    const studentMatchedIds = new Set<number>();
    const gtMatchedIds = new Set<number>();
    
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

    const createMatchResult = (gt: BboxAnnotation, student: BboxAnnotation, iou: number): Match => {
        const gtLabel = gtCategories.get(gt.category_id) || '';
        const studentLabel = studentCategories.get(student.category_id) || '';
        const labelSimilarity = getStringSimilarity(gtLabel, studentLabel);
        
        let pairAttributeSimilarity = 1.0;
        let attributeScores: AttributeScoreDetail[] = [];
        
        const gtAttributeKeys = gt.attributes ? Object.keys(gt.attributes) : [];
        const attributesToCompare = gtAttributeKeys.filter(
            a => a.toLowerCase() !== 'label' && (!matchKey || a.toLowerCase() !== matchKey.toLowerCase())
        );

        if (attributesToCompare.length > 0) {
            let currentPairSimilaritySum = 0;
            for (const attrName of attributesToCompare) {
                const gtValue = getAnnotationAttribute(gt, attrName) || '';
                const studentValue = getAnnotationAttribute(student, attrName) || '';
                const similarity = getStringSimilarity(gtValue, studentValue);
                attributeScores.push({ name: attrName, gtValue, studentValue, similarity });
                currentPairSimilaritySum += similarity;
            }
            pairAttributeSimilarity = currentPairSimilaritySum / attributesToCompare.length;
        }

        const originalScore = calculateMatchQuality(iou, labelSimilarity, pairAttributeSimilarity, weights);
        
        return { 
            gt, 
            student, 
            iou, 
            labelSimilarity, 
            attributeSimilarity: pairAttributeSimilarity, 
            attributeScores,
            originalScore, 
            overrideScore: null 
        };
    };


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
                    const matchResult = createMatchResult(gt, student, iou);
                    imageMatched.push(matchResult);
                    studentMap.delete(key);
                }
            }
        }
        
        // Fallback pass: For annotations not matched by key
        const remainingGt = gtAnnotations.filter(ann => !gtMatchedIds.has(ann.id));
        const remainingStudent = studentAnnotations.filter(ann => !imageUsedStudentIds.has(ann.id));

        const optimalMatches = findOptimalMatches(remainingGt, remainingStudent, IOU_THRESHOLD);

        for (const { gtIndex, studentIndex, iou } of optimalMatches) {
            const gt = remainingGt[gtIndex];
            const student = remainingStudent[studentIndex];
            
            gtMatchedIds.add(gt.id);
            studentMatchedIds.add(student.id);
            imageUsedStudentIds.add(student.id);

            const matchResult = createMatchResult(gt, student, iou);
            imageMatched.push(matchResult);
        }
        
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

    // Now, aggregate stats from all image_results
    const final_matched = image_results.flatMap(ir => ir.matched);
    const final_missed = image_results.flatMap(ir => ir.missed);
    const final_extra = image_results.flatMap(ir => ir.extra);
    
    const averageQuality = final_matched.length > 0
        ? final_matched.reduce((sum, m) => sum + m.originalScore, 0) / final_matched.length
        : 100; // Default to 100 if no matches to avoid penalizing empty images

    const averageIou = final_matched.length > 0 ? final_matched.reduce((acc, m) => acc + m.iou, 0) / final_matched.length : 0;
    const totalLabelSimilarity = final_matched.reduce((acc, m) => acc + m.labelSimilarity, 0);

    const allAttributeScores = final_matched.flatMap(m => m.attributeScores);
    const averageAttributeSimilarity = allAttributeScores.length > 0
        ? allAttributeScores.reduce((acc, s) => acc + s.similarity, 0) / allAttributeScores.length
        : 1;

    const label_accuracy: LabelAccuracy = {
        correct: totalLabelSimilarity,
        total: final_matched.length,
        accuracy: final_matched.length > 0 ? (totalLabelSimilarity / final_matched.length) * 100 : 100,
    };

    const attribute_accuracy: AttributeAccuracy = {
        average_similarity: averageAttributeSimilarity * 100,
        total: allAttributeScores.length,
    };
    
    const totalGtAnnotations = final_matched.length + final_missed.length;
    const totalStudentAnnotations = final_matched.length + final_extra.length;
    
    const precision = totalStudentAnnotations > 0 ? final_matched.length / totalStudentAnnotations : 0;
    const recall = totalGtAnnotations > 0 ? final_matched.length / totalGtAnnotations : 0;
    
    const beta = 0.5;
    const fbetaScore = (precision > 0 || recall > 0)
        ? (1 + beta**2) * (precision * recall) / ((beta**2 * precision) + recall)
        : 0;

    const completenessScore = fbetaScore * 100;

    const totalWeight = weights.quality + weights.completeness;
    let finalScore = 100;
    if (totalWeight > 0) {
        const weightedScore = (averageQuality * weights.quality) + (completenessScore * weights.completeness);
        finalScore = Math.round(weightedScore / totalWeight);
    }
    
    const feedback: string[] = [];
    feedback.push(`The final score is a blend of annotation Quality (${weights.quality}%) and submission Completeness (${weights.completeness}%).`);
    if (final_missed.length > 0) feedback.push(`You missed ${final_missed.length} annotations, which lowered your Completeness score.`);
    if (final_extra.length > 0) feedback.push(`You added ${final_extra.length} extra annotations, which lowered your Completeness score.`);
    
    const mislabeledCount = final_matched.length - totalLabelSimilarity;
    if (mislabeledCount > 0.5) feedback.push(`Found approximately ${Math.round(mislabeledCount)} mislabeled or poorly labeled annotations.`);

    const critical_issues: string[] = [];
    if (recall < 0.5 && totalGtAnnotations > 5) critical_issues.push(`High number of missed annotations (${final_missed.length}). Review the GT carefully.`);
    if (precision < 0.5 && totalStudentAnnotations > 5) critical_issues.push(`High number of extra annotations (${final_extra.length}). Ensure you only annotate required objects.`);
    if(label_accuracy.accuracy < 70 && label_accuracy.total > 5) critical_issues.push(`Low label accuracy: ${label_accuracy.accuracy.toFixed(1)}%. Double-check object classes.`);
    if(attribute_accuracy.average_similarity < 70 && attribute_accuracy.total > 0) critical_issues.push(`Low attribute accuracy: ${attribute_accuracy.average_similarity.toFixed(1)}%. Check for typos or incorrect text.`);

    return {
        source: 'rule-based',
        score: finalScore,
        feedback,
        matched: final_matched,
        missed: final_missed,
        extra: final_extra,
        average_iou: averageIou,
        label_accuracy,
        attribute_accuracy,
        critical_issues,
        image_results,
    };
}


// COCO sigmas for OKS calculation (for human keypoints)
const COCO_SIGMAS = [
    0.026, 0.025, 0.025, 0.035, 0.035, 0.079, 0.079, 0.072, 0.072, 0.062,
    0.062, 0.107, 0.107, 0.087, 0.087, 0.089, 0.089
];


function calculateOKS(gt: BboxAnnotation, student: BboxAnnotation, sigmas: number[]): number {
    const gtKpts = gt.keypoints || [];
    const studentKpts = student.keypoints || [];
    const area = gt.bbox[2] * gt.bbox[3];
    let totalOks = 0;
    let visibleKptsCount = 0;

    for (let i = 0; i < gtKpts.length; i += 3) {
        const gt_v = gtKpts[i + 2];
        if (gt_v > 0) { // Only consider visible GT keypoints
            const gt_x = gtKpts[i];
            const gt_y = gtKpts[i + 1];
            const student_x = studentKpts[i];
            const student_y = studentKpts[i + 1];
            const student_v = studentKpts[i + 2];

            if (student_v > 0) {
                const dx = gt_x - student_x;
                const dy = gt_y - student_y;
                const sigma = sigmas[i / 3];
                const variance = (sigma * 2) ** 2;
                const exponent = (dx ** 2 + dy ** 2) / (2 * area * variance + 1e-9);
                totalOks += Math.exp(-exponent);
            }
            visibleKptsCount++;
        }
    }

    return visibleKptsCount > 0 ? totalOks / visibleKptsCount : 0;
}


export function evaluateSkeletons(gtJson: CocoJson, studentJson: CocoJson): Omit<SkeletonEvaluationResult, 'studentFilename'> {
    const IOU_THRESHOLD = 0.5;

    const allGtAnnotations = gtJson.annotations as BboxAnnotation[];
    const allStudentAnnotations = studentJson.annotations as BboxAnnotation[];
    
    // Assuming a single category for skeletons in this simplified version
    const sigmas = gtJson.categories[0]?.keypoints ? COCO_SIGMAS : [];

    const matched: SkeletonMatch[] = [];
    const studentMatchedIds = new Set<number>();
    
    let totalOks = 0;

    for (const gt of allGtAnnotations) {
        let bestMatch: { student: BboxAnnotation; iou: number } | null = null;
        for (const student of allStudentAnnotations) {
            if (studentMatchedIds.has(student.id)) continue;
            const iou = calculateIoU(gt.bbox, student.bbox);
            if (iou > IOU_THRESHOLD) {
                if (!bestMatch || iou > bestMatch.iou) {
                    bestMatch = { student, iou };
                }
            }
        }
        
        if (bestMatch) {
            studentMatchedIds.add(bestMatch.student.id);
            const oks = calculateOKS(gt, bestMatch.student, sigmas);
            totalOks += oks;
            
            const originalScore = calculateMatchQuality(bestMatch.iou, 1, 1, {iou: 50, label: 25, attribute: 25, quality: 90, completeness: 10}); // Simplified for skeletons
            matched.push({
                gt,
                student: bestMatch.student,
                iou: bestMatch.iou,
                oks,
                labelSimilarity: 1,
                attributeSimilarity: 1,
                attributeScores: [],
                originalScore
            });
        }
    }
    
    const missed = allGtAnnotations
        .filter(gt => !matched.some(m => m.gt.id === gt.id))
        .map(gt => ({ gt }));

    const extra = allStudentAnnotations
        .filter(s => !studentMatchedIds.has(s.id))
        .map(student => ({ student }));

    const averageOks = matched.length > 0 ? totalOks / matched.length : 0;
    const score = Math.round(averageOks * 100);

    const feedback = [
        `Evaluation complete. Average Object Keypoint Similarity (OKS) is ${averageOks.toFixed(3)}.`,
        `Matched ${matched.length} skeletons.`,
        `Found ${missed.length} missed and ${extra.length} extra skeletons.`
    ];

    return {
        score,
        feedback,
        averageOks,
        matched,
        missed,
        extra
    };
}
