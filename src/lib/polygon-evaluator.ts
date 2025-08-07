
import type { CocoJson, PolygonAnnotation, PolygonEvaluationResult, PolygonMatch, Point, Polygon as PolygonType } from './types';
import KDBush from 'kdbush';
import pc from 'polygon-clipping';

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
    const tree = new KDBush(gt_polygon.length);
    for (const point of gt_polygon) {
        tree.add(point[0], point[1]);
    }
    tree.finish();

    return annot_polygon.map(point => {
        const nearest = tree.within(point[0], point[1], 1)[0]; // Use a small radius and take the first point. KDBush `within` is not ideal for nearest neighbor, but for small distances it works. A more robust solution might require a different library if performance becomes an issue.
        if (nearest !== undefined) {
             const nearestPoint = gt_polygon[nearest];
             const dx = point[0] - nearestPoint[0];
             const dy = point[1] - nearestPoint[1];
             return Math.sqrt(dx * dx + dy * dy);
        }
        // Fallback for points far away
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
    if (deviations.length === 0) return 0;

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

function calculateAttributeScore(gt_attrs: { [key: string]: string | undefined }, annot_attrs: { [key: string]: string | undefined }): number {
    const gtKeys = Object.keys(gt_attrs).filter(k => k !== 'label' && k !== 'annotation no');
    if (gtKeys.length === 0) return 100;

    let correct = 0;
    for (const key of gtKeys) {
        if (annot_attrs[key] !== undefined && annot_attrs[key] === gt_attrs[key]) {
            correct++;
        }
    }
    return (correct / gtKeys.length) * 100;
}

export function evaluatePolygons(gtJson: any, studentJson: any): Omit<PolygonEvaluationResult, 'studentFilename'> {
    const allGtAnnotations: PolygonAnnotation[] = gtJson.annotations || [];
    const allStudentAnnotations: PolygonAnnotation[] = studentJson.annotations || [];

    const matched: PolygonMatch[] = [];
    const studentMatchedIndices = new Set<number>();
    
    const gtAnnsByImage = allGtAnnotations.reduce((acc, ann) => {
        (acc[ann.image_id] = acc[ann.image_id] || []).push(ann);
        return acc;
    }, {} as Record<number, PolygonAnnotation[]>);

    const studentAnnsByImage = allStudentAnnotations.reduce((acc, ann) => {
        (acc[ann.image_id] = acc[ann.image_id] || []).push(ann);
        return acc;
    }, {} as Record<number, PolygonAnnotation[]>);

    const imageIds = Object.keys(gtAnnsByImage).map(Number);

    for (const imageId of imageIds) {
        const gtPolys = gtAnnsByImage[imageId] || [];
        const studentPolys = studentAnnsByImage[imageId] || [];
        const usedStudentIndicesInImage = new Set<number>();

        for (const gtPoly of gtPolys) {
            let bestMatch: { student: PolygonAnnotation; iou: number, index: number } | null = null;
            
            const gtAnnoNo = getAnnotationAttribute(gtPoly, "annotation no");

            for (let i = 0; i < studentPolys.length; i++) {
                if (usedStudentIndicesInImage.has(i)) continue;
                
                const studentPoly = studentPolys[i];
                const studentAnnoNo = getAnnotationAttribute(studentPoly, "annotation no");

                if (gtPoly.category_id === studentPoly.category_id && gtAnnoNo && studentAnnoNo && gtAnnoNo === studentAnnoNo) {
                    const iou = calculatePolygonIoU(gtPoly.segmentation[0], studentPoly.segmentation[0]);
                    if (iou > (bestMatch?.iou || 0)) {
                        bestMatch = { student: studentPoly, iou, index: i };
                    }
                }
            }

            if (bestMatch && bestMatch.iou > 0.1) {
                usedStudentIndicesInImage.add(bestMatch.index);
                studentMatchedIndices.add(bestMatch.student.id);

                const deviationScore = calculateDeviationScore(gtPoly.segmentation[0], bestMatch.student.segmentation[0]);
                const iouScore = bestMatch.iou * 100;
                const polygonScore = (iouScore * 0.5) + (deviationScore * 0.5);
                const attributeScore = calculateAttributeScore(gtPoly.attributes || {}, bestMatch.student.attributes || {});
                const finalScore = (polygonScore + attributeScore) / 2;

                matched.push({
                    gt: gtPoly,
                    student: bestMatch.student,
                    iou: bestMatch.iou,
                    deviation: deviationScore,
                    polygonScore,
                    attributeScore,
                    finalScore
                });
            }
        }
    }
    
    const missed = allGtAnnotations
        .filter(gt => !matched.some(m => m.gt.id === gt.id))
        .map(gt => ({ gt }));

    const extra = allStudentAnnotations
        .filter(s => !studentMatchedIndices.has(s.id))
        .map(student => ({ student }));

    const numMatched = matched.length;
    const averageIoU = numMatched > 0 ? matched.reduce((sum, m) => sum + m.iou, 0) / numMatched : 0;
    const averageDeviation = numMatched > 0 ? matched.reduce((sum, m) => sum + m.deviation, 0) / numMatched : 0;
    const averagePolygonScore = numMatched > 0 ? matched.reduce((sum, m) => sum + m.polygonScore, 0) / numMatched : 0;
    const averageAttributeScore = numMatched > 0 ? matched.reduce((sum, m) => sum + m.attributeScore, 0) / numMatched : 0;
    const finalScore = numMatched > 0 ? matched.reduce((sum, m) => sum + m.finalScore, 0) / numMatched : 0;

    const feedback: string[] = [
        `Evaluation complete. Overall score reflects a weighted average of polygon and attribute accuracy.`,
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
