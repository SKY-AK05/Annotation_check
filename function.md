# Annotator AI: Technical Deep Dive & System Documentation

**Document Version:** 1.0
**Status:** Current

---

## 1. Introduction & Core Purpose

Annotator AI is a specialized web application designed to automate and standardize the evaluation of image annotation tasks. In fields like computer vision and machine learning, accurately annotated datasets are the foundation for training reliable models. This tool addresses a common challenge in academic and professional training settings: the need for a consistent, objective, and efficient way to score the quality of annotations produced by students or junior annotators.

The core mission of Annotator AI is to bridge the gap between an expert-annotated "Ground Truth" (GT) dataset and a student's submission. It moves beyond simple pass/fail metrics to provide nuanced, actionable feedback, helping learners understand their mistakes and improve their skills. By ingesting standard annotation formats (COCO JSON and CVAT XML), the tool provides a flexible platform for various annotation projects, focusing initially on bounding box, skeleton, and polygon annotations.

A key innovation within this application is its hybrid evaluation model. It combines a deterministic, rule-based engine for objective scoring with a powerful, AI-driven schema extraction system. This allows the application to dynamically adapt its evaluation criteria based on the structure of the provided Ground Truth file, making it highly versatile.

### 1.1. Key Features from a Technical Perspective

*   **Dynamic Rule Generation:** Instead of relying on hardcoded evaluation logic, the application uses a Genkit AI flow (`extractEvalSchema`) to analyze the Ground Truth file. It identifies the object labels, their associated attributes (like `license_plate_number`), and a potential unique matching key, generating a human-readable pseudocode that defines the evaluation strategy for that specific task.
*   **Multi-Format Annotation Parsing:** The tool robustly handles two of the most common annotation formats: COCO JSON and CVAT XML 1.1. It contains dedicated parsers that normalize these different formats into a single internal data structure (`CocoJson`), allowing the core evaluation logic to be format-agnostic.
*   **Multi-Modal Rule-Based Evaluation Engine:** The primary evaluation is conducted by sophisticated TypeScript modules (`evaluator.ts`, `polygon-evaluator.ts`). These engines calculate:
    *   **Bounding Box:** Intersection over Union (IoU) for localization accuracy, label comparison, and Levenshtein distance for textual attribute similarity.
    *   **Polygon:** A composite score based on Polygon IoU and vertex deviation analysis.
    *   **Skeleton:** Object Keypoint Similarity (OKS) for pose estimation accuracy.
*   **Comprehensive Results Dashboard:** The results of the evaluation are presented in a rich, interactive dashboard. This includes a top-level score, detailed feedback messages, lists of matched, missed, and extra annotations, and granular accuracy metrics.
*   **Modern, Component-Based Frontend:** The user interface is built with Next.js and React, leveraging the App Router for clean, server-rendered components. Styling is managed by Tailwind CSS, and the UI components are from the popular ShadCN UI library, ensuring a professional, consistent, and responsive user experience.
*   **Server-Side AI with Genkit:** All AI-related operations are handled by Genkit, Google's generative AI toolkit. This keeps heavy processing on the server, ensuring the client-side remains lightweight and responsive. AI is used smartly—not to perform the evaluation itself, but to configure the rules for the deterministic evaluation engine.

---

## 2. System Architecture & Data Flow

Annotator AI employs a hybrid architecture that leverages both client-side and server-side processing to balance user privacy, responsiveness, and intelligent feature generation.

### 2.1. High-Level Architecture

The system can be conceptually divided into three main parts:
1.  **Client-Side UI (Next.js/React):** The user-facing application that runs entirely in the browser. It handles file uploads, state management, and rendering of the evaluation form and results dashboard.
2.  **Client-Side Evaluation Engine (TypeScript):** Pure TypeScript modules that execute the core scoring logic within the browser. This ensures that sensitive ground truth and student data (especially images) do not need to be persistently stored on a server for evaluation.
3.  **Server-Side AI Service (Genkit/Google AI):** A serverless function responsible for the "heavy lifting" of AI-driven rule generation. It receives the text content of the GT file, processes it with a large language model, and returns a structured configuration object.

**Architectural Diagram:**

```
+-------------------------------------------------+      +-----------------------------------------+
|                User's Browser                   |      |           Server-Side (Cloud)           |
|                                                 |      |                                         |
| +---------------------------------------------+ |      | +-------------------------------------+ |
| |        Next.js / React Frontend             | |      | |     Genkit AI Flow (Server Action)    | |
| |  (src/app/page.tsx, src/components/*)       | |      | | (src/ai/flows/extract-eval-schema.ts) | |
| +----------------------+----------------------+ |      | +---------------------+---------------+ |
|                        |                        |      |                       |                 |
| (File Upload & State)  | (Display Results)      |      | (Invokes Gemini Model)  |                 |
|                        |                        |      |                       |                 |
| +----------------------v----------------------+ |      | +---------------------v---------------+ |
| |      Client-Side Evaluation Engine          | |      | |       Google Generative AI          | |
| | (src/lib/evaluator.ts, polygon-evaluator.ts)| |      | |         (Gemini 1.5 Flash)          | |
| +---------------------------------------------+ |      | +-------------------------------------+ |
|                                                 |      |                                         |
+-------------------------------------------------+      +-----------------------------------------+
       ^                                      |
       | (User Data: GT File, Student Files, Images) |
       +----------------------------------------------+
                                | (API Call with GT file text only)
                                v
```

### 2.2. End-to-End Data Flow

The data flow is designed for privacy and efficiency, ensuring that only the minimum necessary data is sent to the server.

1.  **Ground Truth Upload:**
    *   **User Action:** The user uploads a Ground Truth file (JSON, XML, or a ZIP archive containing the annotation file and images) via the `EvaluationForm` component.
    *   **Client-Side Processing:** The `handleGtFileChange` function in `src/app/page.tsx` is triggered.
        *   If it's a ZIP file, `JSZip` is used in the browser to extract the annotation file (`.json` or `.xml`) and all image files. The images are converted to local blob URLs using `URL.createObjectURL()` for rendering, and they are never sent to the server.
        *   The content of the annotation file is read into a string.
    *   **AI Schema Generation (Server-Side):**
        *   The text content of the GT annotation file is sent to the `extractEvalSchema` server action.
        *   This Genkit flow invokes the Gemini Pro model, providing the file content and a Zod schema that defines the desired JSON output format.
        *   The AI model analyzes the structure of the annotations (labels, attributes, potential unique IDs) and generates an `EvalSchema` object.
    *   **State Update:** The returned `EvalSchema` object is stored in the React state of the main page. The UI updates to show the generated rules in the `RuleConfiguration` component.

2.  **Evaluation Execution:**
    *   **User Action:** The user uploads one or more student annotation files and clicks "Run Evaluation."
    *   **Client-Side Processing:** The `handleEvaluate` function in `src/app/page.tsx` is triggered.
        *   The GT and student annotation files are parsed into the internal `CocoJson` format. The `parseCvatXml` or `parseCvatXmlForPolygons` function is used for XML files, while `JSON.parse` is used for JSON files. This normalization is critical.
        *   The appropriate evaluation function (`evaluateAnnotations` or `evaluatePolygons`) is called from the corresponding evaluator module.
        *   The function is passed the parsed GT data, the parsed student data, and the `EvalSchema` from the component's state.
    *   **Core Evaluation (In-Browser):** The evaluator module executes the entire comparison logic locally. It iterates through annotations, calculates metrics (IoU, OKS, etc.), and builds a detailed `EvaluationResult` object.
    *   **State Update & Display:** The `EvaluationResult` object is stored in the React state. The `ResultsDashboard` component receives this new data and re-renders to display the final score, feedback, and detailed breakdown tables.

---

## 3. Technology Stack & Dependencies

The application is built on a modern, type-safe technology stack chosen for scalability, developer experience, and performance.

| Category         | Technology / Library          | Version    | License   | Purpose                                                                                             |
| ---------------- | ----------------------------- | ---------- | --------- | --------------------------------------------------------------------------------------------------- |
| **Framework**      | Next.js                       | `15.3.3`   | MIT       | React framework with App Router for Server Components, routing, and server actions.                 |
| **Language**       | TypeScript                    | `^5`       | Apache-2.0| Provides static typing for the entire codebase, ensuring data integrity and maintainability.        |
| **UI Library**     | React                         | `^18.3.1`  | MIT       | Core library for building the user interface.                                                       |
| **UI Components**  | ShadCN UI                     | N/A        | MIT       | A collection of accessible and composable components built on Radix UI and styled with Tailwind CSS.  |
| **Styling**        | Tailwind CSS                  | `^3.4.1`   | MIT       | Utility-first CSS framework for rapid UI development.                                               |
| **AI Toolkit**     | Genkit                        | `latest`   | Apache-2.0| Google's framework for building and managing production-ready AI flows.                             |
| **AI Provider**    | `@genkit-ai/googleai`         | `latest`   | Apache-2.0| Genkit plugin for integrating with Google's Gemini family of models.                                |
| **Schema/Validation**| Zod                           | `^3.24.2`  | MIT       | Defines and validates data structures, especially for AI model inputs and outputs.                  |
| **Form Management**| React Hook Form               | `^7.54.2`  | MIT       | Manages form state, validation, and submission handling.                                            |
|                  | `@hookform/resolvers`         | `^4.1.3`   | MIT       | Zod resolver for React Hook Form.                                                                   |
| **File Handling**  | JSZip                         | `^3.10.1`  | MIT       | Library for reading and creating .zip files in the browser.                                         |
| **Icons**          | Lucide React                  | `^0.475.0` | ISC       | Library of simple and clean SVG icons.                                                              |
| **Polygon Math**   | `polygon-clipping`            | `^0.15.3`  | ISC       | Robust library for performing boolean operations on polygons (intersection, union), used for IoU.   |
| **Spatial Indexing**| `kdbush`                      | `^4.0.2`   | ISC       | A fast library for spatial indexing of 2D points, used for efficient vertex deviation calculation. |

---

## 4. Data Formats & Parsers

The tool is designed to be flexible by supporting common annotation formats. This is achieved through a normalization process where different input formats are parsed into a standardized internal data structure.

### 4.1. Supported Input Formats

*   **COCO JSON:** The de-facto standard for object detection, segmentation, and keypoint tasks. Fully supported for bounding boxes, polygons, and keypoints. The system parses the `images`, `annotations`, and `categories` arrays.
*   **CVAT XML 1.1:** A popular format from the CVAT (Computer Vision Annotation Tool).
    *   `<box>` tags are parsed for bounding box evaluations.
    *   `<polygon>` tags are parsed for polygon evaluations.
    *   `<attribute>` child elements are parsed for both and mapped to the internal `attributes` object.
*   **ZIP Archive (`.zip`):** For convenience, the system accepts a single `.zip` file. It expects the archive to contain:
    *   One annotation file (either `.json` or `.xml`).
    *   The corresponding image files (`.jpg`, `.jpeg`, `.png`, `.webp`). This is the recommended way to provide images, as it bundles all necessary assets together.

### 4.2. Internal Data Structure (`CocoJson`)

All input formats are parsed into an internal `CocoJson`-like structure defined in `src/lib/types.ts`. This allows the core evaluation logic to be completely format-agnostic.

```typescript
// From src/lib/types.ts

// Represents a single image.
export interface CocoImage {
    id: number;
    file_name: string;
    height: number;
    width: number;
}

// Represents a single category or label.
export interface CocoCategory {
    id: number;
    name: string;
    supercategory?: string;
    keypoints?: string[];
    skeleton?: number[][];
}

// Represents a single bounding box annotation.
export interface BboxAnnotation {
    id: number;
    image_id: number;
    category_id: number;
    bbox: [number, number, number, number]; // [x, y, width, height]
    attributes?: { [key: string]: string | undefined; };
    keypoints?: number[]; // For skeleton tasks
    // ...
}

// Represents a single polygon annotation.
export interface PolygonAnnotation {
    id: number;
    image_id: number;
    category_id: number;
    segmentation: Point[][]; // Array of polygons
    area: number;
    bbox: [number, number, number, number];
    attributes?: { [key: string]: string | undefined; };
}

// The unified internal format.
export interface CocoJson {
    images: CocoImage[];
    annotations: BboxAnnotation[] | PolygonAnnotation[]; // Union type
    categories: CocoCategory[];
}
```

### 4.3. Parsers

*   **`JSON.parse()`:** Used for all `.json` files.
*   **`parseCvatXml(xmlString)` in `src/lib/cvat-xml-parser.ts`:**
    *   **Input:** A string containing the content of a CVAT XML 1.1 file.
    *   **Process:** Uses the browser's native `DOMParser` to create an XML document. It then iterates through `<image>` and `<box>` nodes, extracting attributes (`id`, `name`, `xtl`, `ytl`, etc.) and child `<attribute>` nodes.
    *   **Output:** A `CocoJson` object with `BboxAnnotation[]` in the `annotations` field.
*   **`parseCvatXmlForPolygons(xmlString)` in `src/lib/cvat-xml-parser.ts`:**
    *   **Input:** A string containing the content of a CVAT XML 1.1 file.
    *   **Process:** Similar to the bounding box parser, but it queries for `<polygon>` nodes. It parses the `points` attribute string (e.g., `"x1,y1;x2,y2;..."`) into the `Point[][]` format required for the `segmentation` field.
    *   **Output:** A `CocoJson` object with `PolygonAnnotation[]` in the `annotations` field.

---

## 5. Core Evaluation Algorithms & Functions

The evaluation logic is deterministic and resides entirely on the client side in pure TypeScript modules.

### 5.1. Bounding Box Evaluation (`src/lib/evaluator.ts`)

#### `evaluateAnnotations(gtJson, studentJson, schema)`

*   **Inputs:**
    *   `gtJson: CocoJson`: The parsed ground truth data.
    *   `studentJson: CocoJson`: The parsed student data.
    *   `schema: EvalSchema`: The configuration object generated by the AI.
*   **Output:** `EvaluationResult`
*   **Process:**
    1.  **Grouping:** Annotations from both GT and student are grouped by `image_id`.
    2.  **Matching (Pass 1 - Key-Based):** If the `schema` provides a `matchKey`, the evaluator performs a 1:1 match. It iterates through GT annotations and looks for a student annotation in the same image with an identical value for that `matchKey` attribute. This is the most reliable matching method.
    3.  **Matching (Pass 2 - IoU-Based Fallback):** For any remaining unmatched GT annotations, the evaluator attempts to find the best match based on IoU. It compares the GT annotation against all remaining student annotations in the same image and selects the one with the highest IoU, provided it exceeds a threshold (currently `0.5`).
    4.  **Metric Calculation:** For each matched pair, it calculates:
        *   **IoU:** Using the `calculateIoU` function.
        *   **Label Accuracy:** Checks if the `category_id` is the same.
        *   **Attribute Similarity:** For each attribute defined in the `schema`, it uses `getStringSimilarity` (which implements the Levenshtein distance algorithm) to compare the GT and student attribute values.
    5.  **Categorization:** Unmatched GT annotations are classed as `missed`. Unmatched student annotations are classed as `extra`.
    6.  **Scoring:** A final weighted score is computed:
        *   **Detection Score (40%):** F-beta score (beta=0.5, weighing precision higher) based on `matched`, `missed`, and `extra` counts.
        *   **Localization Score (30%):** Average IoU of all matched pairs.
        *   **Label Score (20%):** Percentage of matched pairs with the correct label.
        *   **Attribute Score (10%):** Average similarity score for all compared attributes.

#### `calculateIoU(boxA, boxB)`
*   **Inputs:** `boxA: number[]`, `boxB: number[]` (each in `[x, y, width, height]` format).
*   **Output:** `number` (a float between 0.0 and 1.0).
*   **Algorithm:** Standard axis-aligned bounding box intersection over union.

### 5.2. Polygon Evaluation (`src/lib/polygon-evaluator.ts`)

#### `evaluatePolygons(gtJson, studentJson, schema)`
*   **Inputs:** Same as the bounding box evaluator.
*   **Output:** `PolygonEvaluationResult`
*   **Process:**
    1.  **Grouping & Matching:** Follows the same key-based and IoU-based two-pass matching logic as the bounding box evaluator. The key difference is that IoU is calculated using `calculatePolygonIoU`.
    2.  **Metric Calculation:** For each matched pair, it calculates:
        *   **Polygon IoU:** Using `calculatePolygonIoU`.
        *   **Deviation Score:** Using `calculateDeviationScore`.
        *   **Polygon Score:** A 50/50 weighted average of the IoU score and the Deviation Score.
        *   **Attribute Score:** Using `calculateAttributeScore`.
        *   **Final Score:** A 50/50 weighted average of the Polygon Score and the Attribute Score.

#### `calculatePolygonIoU(poly1, poly2)`
*   **Inputs:** `poly1: Point[][]`, `poly2: Point[][]`.
*   **Output:** `number` (a float between 0.0 and 1.0).
*   **Algorithm:** Uses the `polygon-clipping` library to perform a boolean intersection and union on the two polygon shapes. The IoU is the ratio of the intersection area to the union area.

#### `calculateDeviationScore(gt_polygon, annot_polygon)`
*   **Inputs:** `gt_polygon: Point[]`, `annot_polygon: Point[]`.
*   **Output:** `number` (a score from 0 to 100).
*   **Algorithm:**
    1.  A `k-d tree` is constructed from the vertices of the `gt_polygon` using the `kdbush` library for efficient nearest-neighbor searches.
    2.  For each vertex in the `annot_polygon`, it finds the shortest distance to any vertex in the `gt_polygon`.
    3.  These distances (deviations) are categorized into "perfect," "minor," "moderate," and "major" based on pixel thresholds.
    4.  A final score is calculated by penalizing larger deviations more heavily.

### 5.3. Skeleton Evaluation (`src/lib/evaluator.ts`)

#### `evaluateSkeletons(gtJson, studentJson)`
*   **Inputs:** `gtJson: CocoJson`, `studentJson: CocoJson`.
*   **Output:** `SkeletonEvaluationResult`.
*   **Process:**
    1.  **Matching:** Skeletons are matched based on the IoU of their parent bounding boxes, using a threshold of `0.5`. This assumes each person/skeleton has a corresponding bounding box annotation.
    2.  **OKS Calculation:** For each matched pair, it calls `calculateOKS`.
    3.  **Scoring:** The final score is the average OKS across all matched pairs, scaled to 100.

#### `calculateOKS(gt, student, sigmas)`
*   **Inputs:**
    *   `gt: BboxAnnotation`: The GT annotation containing keypoints.
    *   `student: BboxAnnotation`: The student annotation containing keypoints.
    *   `sigmas: number[]`: An array of per-keypoint constants that normalize the distance calculation (COCO defaults are used).
*   **Output:** `number` (a float between 0.0 and 1.0).
*   **Algorithm:** Implements the standard Object Keypoint Similarity formula. For each visible keypoint in the GT, it calculates the squared Euclidean distance between the GT and student keypoint, normalizes it by the object's scale and the keypoint-specific sigma, and passes it through an exponential function. The final OKS is the average of these values over all visible keypoints.

---

## 6. AI-Driven Rule Generation

The "secret sauce" of the tool's flexibility is the server-side AI flow that generates the evaluation schema.

### `extractEvalSchema(input)` (`src/ai/flows/extract-eval-schema.ts`)

*   **Inputs:** `EvalSchemaInput` object:
    *   `gtFileContent: string`: The full text content of the ground truth annotation file.
    *   `userInstructions?: string`: (Optional) Plain-text instructions from the user to modify the logic.
    *   `pseudoCode?: string`: (Optional) User-edited pseudocode to be reverse-engineered.
*   **Output:** A `Promise<EvalSchema>` object.
*   **Process:**
    1.  The function is a Genkit flow, decorated with `ai.defineFlow`.
    2.  It uses a prompt defined with `ai.definePrompt`. The prompt instructs the Gemini model on how to behave.
    3.  **Prioritization Logic:** The prompt has a strict order of operations:
        *   If `userInstructions` are present, they are the source of truth. The model must generate a new schema and pseudocode that strictly follows these instructions.
        *   If `pseudoCode` is present (and instructions are not), the model must reverse-engineer the pseudocode to generate the structured parts of the schema (`labels`, `matchKey`).
        *   If neither is present, the model derives the schema by analyzing the raw `gtFileContent`.
    4.  **Zod Schema:** The `output` of the prompt is constrained to the `EvalSchemaSchema` (a Zod schema). This forces the LLM to return a well-structured JSON object, preventing malformed responses.
    5.  **Error Handling:** The flow includes a `try...catch` block to handle potential API errors from the AI service (e.g., service unavailability), returning user-friendly error messages.

**Example API Call (Conceptual):**

**Request (Client to Server Action):**
```json
{
  "gtFileContent": "{\"images\":[...], \"categories\":[...], \"annotations\":[{\"image_id\":1, \"category_id\":1, \"bbox\":[...], \"attributes\":{\"color\":\"red\", \"Annotation No\":\"123\"}}]}"
}
```

**Response (Server Action to Client):**
```json
{
  "labels": [
    {
      "name": "vehicle",
      "attributes": ["color", "Annotation No"]
    }
  ],
  "matchKey": "Annotation No",
  "pseudoCode": "def evaluate_student_annotations(...):\n  # 1. Match annotations using 'Annotation No' as the unique key.\n  # 2. For each matched 'vehicle' annotation:\n  #    a. Calculate IoU for the bounding box.\n  #    b. Check for an exact match on the 'color' attribute."
}
```
This response object is then used to parameterize the client-side evaluation engine.
