



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
    if (!poly1 || poly1.length === 0 || !poly2 || poly2.length === 0) return 0;
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
    if (!gt_polygon || gt_polygon.length === 0 || !annot_polygon || annot_polygon.length === 0) {
        console.warn("Cannot compute deviations for empty polygon.");
        return [];
    }

    const tree = new KDBush(gt_polygon.length);
    for (const point of gt_polygon) {
        tree.add(point[0], point[1]);
    }
    tree.finish();

    return annot_polygon.map(point => {
        const nearestIndices = tree.within(point[0], point[1], 1); 
        if (nearestIndices.length > 0 && nearestIndices[0] !== undefined) {
             const nearestPoint = gt_polygon[nearestIndices[0]];
             if (nearestPoint) {
                const dx = point[0] - nearestPoint[0];
                const dy = point[1] - nearestPoint[1];
                return Math.sqrt(dx * dx + dy * dy);
             }
        }

        console.warn("Could not find nearest point for deviation calculation, falling back to brute force.");
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

function calculateAttributeScore(gt_attrs: { [key: string]: string | undefined }, annot_attrs: { [key: string]: string | undefined }, schema: EvalSchema, label: string): number {
    const labelSchema = schema.labels.find(l => l.name.toLowerCase() === label.toLowerCase());
    if (!labelSchema) return 100;

    const attributesToCompare = labelSchema.attributes.filter(a => a !== schema.matchKey && a !== 'label');
    
    if (attributesToCompare.length === 0) return 100;

    let similaritySum = 0;
    for (const key of attributesToCompare) {
        const gtAttr = gt_attrs[key] || '';
        const studentAttr = annot_attrs[key] || '';
        similaritySum += getStringSimilarity(gtAttr, studentAttr);
    }
    return (similaritySum / attributesToCompare.length) * 100;
}


function findOptimalPolygonMatches(
    gtPolys: PolygonAnnotation[],
    studentPolys: PolygonAnnotation[],
    iouThreshold: number
): { gtIndex: number; studentIndex: number; iou: number }[] {
    if (!gtPolys.length || !studentPolys.length) {
        return [];
    }
    console.log(`Finding optimal matches between ${gtPolys.length} GT and ${studentPolys.length} student polys.`);

    const costMatrix = gtPolys.map(gt =>
        studentPolys.map(student => {
            if (gt.category_id !== student.category_id) {
                return 1_000_000;
            }
            const iou = calculatePolygonIoU(gt.segmentation[0], student.segmentation[0]);
            return iou >= iouThreshold ? 1 - iou : 1_000_000;
        })
    );

    const assignments = munkres(costMatrix) as [number, number][];

    const matches: { gtIndex: number; studentIndex: number; iou: number }[] = [];
    for (const [gtIndex, studentIndex] of assignments) {
        if (costMatrix[gtIndex]?.[studentIndex] === undefined) continue;
        const cost = costMatrix[gtIndex][studentIndex];
        if (cost < 1_000_000) {
            matches.push({
                gtIndex,
                studentIndex,
                iou: 1 - cost,
            });
        }
    }
    console.log(`Found ${matches.length} optimal matches.`);
    return matches;
}


export function evaluatePolygons(gtJson: any, studentJson: any, schema: EvalSchema): Omit<PolygonEvaluationResult, 'studentFilename'> {
    const IOU_THRESHOLD = 0.1; 
    const allGtAnnotations: PolygonAnnotation[] = gtJson.annotations || [];
    const allStudentAnnotations: PolygonAnnotation[] = studentJson.annotations || [];

    const gtCategories = new Map((gtJson.categories || []).map(c => [c.id, c.name]));
    const studentCategories = new Map((studentJson.categories || []).map(c => [c.id, c.name]));

    const imageNameToId = new Map<string, number>();
    gtJson.images.forEach((img: any) => imageNameToId.set(img.file_name, img.id));
    studentJson.images.forEach((img: any) => {
        if (!imageNameToId.has(img.file_name)) {
            imageNameToId.set(img.file_name, img.id);
        }
    });

    const imageNameMap = new Map<number, string>();
    gtJson.images.forEach((img: any) => imageNameMap.set(img.id, img.file_name));
    studentJson.images.forEach((img: any) => {
        if (!imageNameMap.has(img.id)) {
            imageNameMap.set(img.id, img.file_name);
        }
    });

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

    const imageIds = new Set([...Object.keys(gtAnnsByImage).map(Number), ...Object.keys(studentAnnsByImage).map(Number)]);
    const matchKey = schema.matchKey;

    for (const imageId of imageIds) {
        const gtPolys = gtAnnsByImage[imageId] || [];
        const studentPolys = studentAnnsByImage[imageId] || [];

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
                    const gtLabel = gtCategories.get(gtPoly.category_id) || '';
                    const studentLabel = studentCategories.get(studentPoly.category_id) || '';
                    const isLabelMatch = gtLabel.toLowerCase() === studentLabel.toLowerCase();

                    const attributeScore = calculateAttributeScore(gtPoly.attributes || {}, studentPoly.attributes || {}, schema, studentLabel);
                    
                    const finalScore = (iou * 100 * 0.70) + ((isLabelMatch ? 100 : 0) * 0.15) + (attributeScore * 0.15);

                    matched.push({
                        gt: gtPoly,
                        student: studentPoly,
                        iou,
                        attributeScore,
                        finalScore
                    });

                    studentMap.delete(key);
                }
            }
        }

        const remainingGt = gtPolys.filter(ann => !gtMatchedIds.has(ann.id));
        const remainingStudent = studentPolys.filter(ann => !studentMatchedIds.has(ann.id));

        const optimalMatches = findOptimalPolygonMatches(remainingGt, remainingStudent, IOU_THRESHOLD);

        for (const { gtIndex, studentIndex, iou } of optimalMatches) {
            const gtPoly = remainingGt[gtIndex];
            const studentPoly = remainingStudent[studentIndex];
            
            gtMatchedIds.add(gtPoly.id);
            studentMatchedIds.add(studentPoly.id);

            const gtLabel = gtCategories.get(gtPoly.category_id) || '';
            const studentLabel = studentCategories.get(studentPoly.category_id) || '';
            const isLabelMatch = gtLabel.toLowerCase() === studentLabel.toLowerCase();

            const attributeScore = calculateAttributeScore(gtPoly.attributes || {}, studentPoly.attributes || {}, schema, studentLabel);
            const finalScore = (iou * 100 * 0.70) + ((isLabelMatch ? 100 : 0) * 0.15) + (attributeScore * 0.15);
            
            matched.push({
                gt: gtPoly,
                student: studentPoly,
                iou: iou,
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
    const averageAttributeScore = numMatched > 0 ? matched.reduce((sum, m) => sum + m.attributeScore, 0) / numMatched : 100;
    
    const qualityScore = numMatched > 0 ? matched.reduce((sum, m) => sum + m.finalScore, 0) / numMatched : 0;
    const precision = (numMatched + extra.length) > 0 ? numMatched / (numMatched + extra.length) : 0;
    const recall = (numMatched + missed.length) > 0 ? numMatched / (numMatched + missed.length) : 0;

    const completenessScore = (precision > 0 || recall > 0) ? (1.25 * precision * recall) / (0.25 * precision + recall) * 100 : 0;
    
    const finalScore = (qualityScore * 0.5) + (completenessScore * 0.5);

    const feedback: string[] = [
        `Evaluation complete. Overall score reflects a blend of match quality and completeness.`,
        `Matched ${numMatched} polygons.`,
        `Found ${missed.length} missed and ${extra.length} extra polygons.`
    ];

    return {
        score: Math.round(finalScore),
        feedback,
        averageIoU,
        averageAttributeScore,
        matched,
        missed,
        extra,
        imageNameMap
    };
}
