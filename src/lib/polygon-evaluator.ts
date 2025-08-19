
import type { PolygonAnnotation, PolygonEvaluationResult, PolygonMatch, Point, Polygon as PolygonType } from './types';
import type { EvalSchema } from '@/ai/flows/extract-eval-schema';
import KDBush from 'kdbush';
import pc from 'polygon-clipping';
import munkres from 'munkres-js';


function getAnnotationAttribute(annotation: PolygonAnnotation, key: string): string | undefined {
    return annotation.attributes?.[key];
}

function calculatePolygonArea(polygon: PolygonType): number {
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        area += polygon[i][0] * polygon[j][1];
        area -= polygon[j][0] * polygon[i][1];
    }
    return Math.abs(area / 2);
}

function calculatePolygonIoU(poly1: PolygonType, poly2: PolygonType): number {
    try {
        const intersection = pc.intersection([poly1], [poly2]);
        if (intersection.length === 0) return 0;
        
        const intersectionArea = intersection.reduce((acc, p) => acc + calculatePolygonArea(p[0]), 0);
        const union = pc.union([poly1], [poly2]);
        const unionArea = union.reduce((acc, p) => acc + calculatePolygonArea(p[0]), 0);

        return unionArea > 0 ? intersectionArea / unionArea : 0;
    } catch (e) {
        console.error("Error calculating IoU:", e);
        return 0;
    }
}

function computeDeviations(gt_polygon: PolygonType, annot_polygon: PolygonType): number[] {
    if (gt_polygon.length === 0 || annot_polygon.length === 0) {
        return [];
    }
    const tree = new KDBush(gt_polygon.length);
    for (const point of gt_polygon) {
        tree.add(point[0], point[1]);
    }
    tree.finish();

    return annot_polygon.map(point => {
        const nearest = tree.within(point[0], point[1], 1)[0]; 
        if (nearest !== undefined) {
             const nearestPoint = gt_polygon[nearest];
             const dx = point[0] - nearestPoint[0];
             const dy = point[1] - nearestPoint[1];
             return Math.sqrt(dx * dx + dy * dy);
        }
        let min_dist_sq = Infinity;
        for (const gt_point of gt_polygon) {
            const dist_sq = (point[0] - gt_point[0]) ** 2 + (point[1] - gt_point[1]) ** 2;
            if (dist_sq < min_dist_sq) {
                min_dist_sq = dist_sq;
            }
        }
        return Math.sqrt(min_dist_sq);
    });
}

function calculateDeviationScore(gt_polygon: PolygonType, annot_polygon: PolygonType): number {
    const deviations = computeDeviations(gt_polygon, annot_polygon);
    if (deviations.length === 0) return 100;

    const perfect = 2, minor = 5, moderate = 10;
    const p_perfect = deviations.filter(d => d <= perfect).length / deviations.length * 100;
    const p_minor = deviations.filter(d => d > perfect && d <= minor).length / deviations.length * 100;
    const p_moderate = deviations.filter(d => d > minor && d <= moderate).length / deviations.length * 100;
    const p_major = deviations.filter(d => d > moderate).length / deviations.length * 100;

    if (p_perfect >= 98) return 100;
    if (p_perfect >= 95) return 98;
    if (p_perfect >= 90) return 95;

    return Math.max(0, 100 - (0.1 * p_minor + 0.3 * p_moderate + 0.5 * p_major));
}

function calculateAttributeScore(gt_attrs: { [key: string]: string | undefined }, annot_attrs: { [key: string]: string | undefined }, schema: EvalSchema, label: string): number {
    const labelSchema = schema.labels.find(l => l.name === label);
    const attributesToCompare = labelSchema ? labelSchema.attributes.filter(a => a !== schema.matchKey && a !== 'label') : [];
    
    if (attributesToCompare.length === 0) return 100;

    let correct = 0;
    for (const key of attributesToCompare) {
        if (annot_attrs[key] !== undefined && annot_attrs[key] === gt_attrs[key]) {
            correct++;
        }
    }
    return (correct / attributesToCompare.length) * 100;
}

/**
 * Finds the optimal assignment between GT and student polygons using the Hungarian algorithm.
 * @param gtPolys - An array of ground truth polygon annotations.
 * @param studentPolys - An array of student polygon annotations.
 * @param iouThreshold - The minimum IoU to consider a potential match.
 * @returns An array of matched pairs with their IoU scores.
 */
function findOptimalPolygonMatches(
    gtPolys: PolygonAnnotation[],
    studentPolys: PolygonAnnotation[],
    iouThreshold: number
): { gtIndex: number; studentIndex: number; iou: number }[] {
    if (!gtPolys.length || !studentPolys.length) {
        return [];
    }

    // Create a cost matrix where cost is 1 - IoU.
    const costMatrix = gtPolys.map(gt =>
        studentPolys.map(student => {
            // Only calculate IoU if categories match.
            if (gt.category_id !== student.category_id) {
                return 1_000_000;
            }
            const iou = calculatePolygonIoU(gt.segmentation[0], student.segmentation[0]);
            // A higher IoU results in a lower cost.
            return iou >= iouThreshold ? 1 - iou : 1_000_000;
        })
    );

    // Run the Hungarian algorithm to find the assignment with the minimum cost.
    const assignments = munkres(costMatrix) as [number, number][];

    const matches: { gtIndex: number; studentIndex: number; iou: number }[] = [];
    for (const [gtIndex, studentIndex] of assignments) {
        const cost = costMatrix[gtIndex][studentIndex];
        // Only include matches that are valid (i.e., not the high-cost dummy value).
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


export function evaluatePolygons(gtJson: any, studentJson: any, schema: EvalSchema): Omit<PolygonEvaluationResult, 'studentFilename'> {
    const IOU_THRESHOLD = 0.1; // Threshold for considering a match in the optimal assignment.
    const allGtAnnotations: PolygonAnnotation[] = gtJson.annotations || [];
    const allStudentAnnotations: PolygonAnnotation[] = studentJson.annotations || [];

    const gtCategories = new Map((gtJson.categories || []).map(c => [c.id, c.name]));

    const matched: PolygonMatch[] = [];
    const gtMatchedIds = new Set<number>();
    const studentMatchedIds = new Set<number>();
    
    const gtAnnsByImage = allGtAnnotations.reduce((acc, ann) => {
        (acc[ann.image_id] = acc[ann.image_id] || []).push(ann);
        return acc;
    }, {} as Record<number, PolygonAnnotation[]>);

    const studentAnnsByImage = allStudentAnnotations.reduce((acc, ann) => {
        (acc[ann.image_id] = acc[ann.image_id] || []).push(ann);
        return acc;
    }, {} as Record<number, PolygonAnnotation[]>);

    const imageIds = Object.keys(gtAnnsByImage).map(Number);
    const matchKey = schema.matchKey;

    for (const imageId of imageIds) {
        const gtPolys = gtAnnsByImage[imageId] || [];
        const studentPolys = studentAnnsByImage[imageId] || [];

        // Pass 1: Key-based matching for deterministic pairs.
        if (matchKey) {
            const studentMap = new Map<string, PolygonAnnotation>();
            studentPolys.forEach(ann => {
                if (studentMatchedIds.has(ann.id)) return;
                const key = getAnnotationAttribute(ann, matchKey);
                if (key) studentMap.set(key, ann);
            });

            for (const gtPoly of gtPolys) {
                if (gtMatchedIds.has(gtPoly.id)) continue;
                const key = getAnnotationAttribute(gtPoly, matchKey);

                if (key && studentMap.has(key)) {
                    const studentPoly = studentMap.get(key)!;
                    
                    gtMatchedIds.add(gtPoly.id);
                    studentMatchedIds.add(studentPoly.id);

                    const iou = calculatePolygonIoU(gtPoly.segmentation[0], studentPoly.segmentation[0]);
                    const deviationScore = calculateDeviationScore(gtPoly.segmentation[0], studentPoly.segmentation[0]);
                    const polygonScore = (iou * 100 * 0.5) + (deviationScore * 0.5);
                    const attributeScore = calculateAttributeScore(gtPoly.attributes || {}, studentPoly.attributes || {}, schema, gtCategories.get(gtPoly.category_id) || '');
                    const finalScore = (polygonScore + attributeScore) / 2;

                    matched.push({
                        gt: gtPoly,
                        student: studentPoly,
                        iou,
                        deviation: deviationScore,
                        polygonScore,
                        attributeScore,
                        finalScore
                    });

                    studentMap.delete(key);
                }
            }
        }

        // Pass 2: Optimal matching for remaining polygons using the Hungarian algorithm.
        const remainingGt = gtPolys.filter(ann => !gtMatchedIds.has(ann.id));
        const remainingStudent = studentPolys.filter(ann => !studentMatchedIds.has(ann.id));

        const optimalMatches = findOptimalPolygonMatches(remainingGt, remainingStudent, IOU_THRESHOLD);

        for (const { gtIndex, studentIndex, iou } of optimalMatches) {
            const gtPoly = remainingGt[gtIndex];
            const studentPoly = remainingStudent[studentIndex];
            
            gtMatchedIds.add(gtPoly.id);
            studentMatchedIds.add(studentPoly.id);

            const deviationScore = calculateDeviationScore(gtPoly.segmentation[0], studentPoly.segmentation[0]);
            const polygonScore = (iou * 100 * 0.5) + (deviationScore * 0.5);
            const attributeScore = calculateAttributeScore(gtPoly.attributes || {}, studentPoly.attributes || {}, schema, gtCategories.get(gtPoly.category_id) || '');
            const finalScore = (polygonScore + attributeScore) / 2;
            
            matched.push({
                gt: gtPoly,
                student: studentPoly,
                iou: iou,
                deviation: deviationScore,
                polygonScore,
                attributeScore,
                finalScore
            });
        }
    }
    
    const missed = allGtAnnotations
        .filter(gt => !gtMatchedIds.has(gt.id))
        .map(gt => ({ gt }));

    const extra = allStudentAnnotations
        .filter(s => !studentMatchedIds.has(s.id))
        .map(student => ({ student }));

    const numMatched = matched.length;
    const averageIoU = numMatched > 0 ? matched.reduce((sum, m) => sum + m.iou, 0) / numMatched : 0;
    const averageDeviation = numMatched > 0 ? matched.reduce((sum, m) => sum + m.deviation, 0) / numMatched : 0;
    const averagePolygonScore = numMatched > 0 ? matched.reduce((sum, m) => sum + m.polygonScore, 0) / numMatched : 0;
    const averageAttributeScore = numMatched > 0 ? matched.reduce((sum, m) => sum + m.attributeScore, 0) / numMatched : 0;
    
    // Calculate final score based on matched quality and penalties for missed/extra.
    const qualityScore = numMatched > 0 ? matched.reduce((sum, m) => sum + m.finalScore, 0) / numMatched : 0;
    const precision = (numMatched + extra.length) > 0 ? numMatched / (numMatched + extra.length) : 0;
    const recall = (numMatched + missed.length) > 0 ? numMatched / (numMatched + missed.length) : 0;
    // F-beta score with beta=0.5 to weigh precision more than recall
    const completenessScore = (precision > 0 || recall > 0) ? (1.25 * precision * recall) / (0.25 * precision + recall) * 100 : 0;
    
    const finalScore = (qualityScore * 0.5) + (completenessScore * 0.5);

    const feedback: string[] = [
        `Evaluation complete. Overall score reflects a blend of match quality, precision, and recall.`,
        `Matched ${numMatched} polygons.`,
        `Found ${missed.length} missed and ${extra.length} extra polygons.`
    ];

    return {
        score: Math.round(finalScore),
        feedback,
        averageIoU,
        averageDeviation,
        averagePolygonScore,
        averageAttributeScore,
        matched,
        missed,
        extra
    };
}
