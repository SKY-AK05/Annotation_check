
import type { EvalSchema } from "@/ai/flows/extract-eval-schema";

export interface FormValues {
  gtFile: File;
  studentFile: File;
  toolType: string;
}

export interface CocoCategory {
    id: number;
    name: string;
    supercategory?: string;
}

export interface CocoImage {
    id: number;
    file_name: string;
    height: number;
    width: number;
}

export interface BboxAnnotation {
    id: number;
    image_id: number;
    category_id: number;
    bbox: [number, number, number, number]; // [x,y,width,height]
    attributes?: {
        [key: string]: string | undefined;
    };
}

export interface CocoJson {
    images: CocoImage[];
    annotations: BboxAnnotation[];
    categories: CocoCategory[];
}

export interface LabelAccuracy {
    correct: number;
    total: number;
    accuracy: number;
}

export interface AttributeAccuracy {
    average_similarity: number;
    total: number;
}

export interface Match {
    gt: BboxAnnotation;
    student: BboxAnnotation;
    iou: number;
    isLabelMatch: boolean;
    attributeSimilarity: number;
}

export interface EvaluationResult {
  source: 'manual';
  score: number;
  feedback: string[];
  matched: { gt: string; student: string; iou: number }[];
  missed: { gt: string }[];
  extra: { student: string }[];
  average_iou: number;
  label_accuracy: LabelAccuracy;
  attribute_accuracy: AttributeAccuracy;
  critical_issues: string[];
}
