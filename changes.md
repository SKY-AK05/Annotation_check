# Annotator AI: Algorithm Evolution & Workflow Documentation

**Version:** 1.0
**Status:** Current

---

## 1. Overview

This document provides a comprehensive technical overview of the Annotator AI evaluation tool. It is intended for developers, system administrators, and technical stakeholders who need to understand the application's workflow, data processing pipeline, and the evolution of its core evaluation algorithms.

We will cover two primary areas:
1.  **The End-to-End Workflow:** A detailed description of the user journey, from file upload to results visualization, detailing the data flow and key processing steps.
2.  **Algorithmic Evolution:** An in-depth analysis of the core annotation matching algorithm, explaining the transition from a **Greedy Best-Match** approach to a more robust **Optimal Bipartite Matching** strategy using the Hungarian algorithm. This section provides a comparative analysis, rationale, and implementation details.

---

## 2. Complete System Workflow

Annotator AI is designed to provide a seamless and private evaluation experience, running primarily within the user's browser. The workflow is divided into two main phases: **Configuration** and **Evaluation**.

### 2.1. Phase 1: Configuration & Rule Generation

This phase is initiated when a user uploads a Ground Truth (GT) file. Its purpose is to dynamically configure the evaluation parameters based on the expert-annotated data.

**Workflow Diagram:**
```
+--------------------------+      +--------------------------------+      +---------------------------+
| 1. User Uploads GT File  |----->| 2. Client-Side File Processor  |----->| 3. AI Schema Generation   |
| (JSON, XML, or ZIP)      |      |   (JSZip for archives)         |      | (Server-Side Genkit Flow) |
+--------------------------+      +--------------------------------+      +---------------------------+
                                                                                       |
                                                                                       v
+--------------------------+      +--------------------------------+      +---------------------------+
| 6. User Customizes Rules |<-----| 5. UI Renders Editable Rules   |<-----| 4. EvalSchema is Returned |
| (Optional, via text)     |      |   (RuleConfiguration component)|      |   and Stored in State     |
+--------------------------+      +--------------------------------+      +---------------------------+
```

**Step-by-Step Breakdown:**

1.  **Input - Ground Truth File:** The user uploads a single GT file via the `EvaluationForm`. Supported formats include:
    *   **COCO JSON**: For bounding box, polygon, or skeleton annotations.
    *   **CVAT XML 1.1**: For bounding box or polygon annotations.
    *   **.ZIP Archive**: A compressed file containing one annotation file (`.json` or `.xml`) and all associated image files (`.jpg`, `.png`, etc.).

2.  **Client-Side Processing:** The `handleGtFileChange` function in `src/app/page.tsx` is triggered.
    *   If a ZIP file is detected, the `JSZip` library is used *in the browser* to read its contents. It identifies the annotation file and extracts all image files.
    *   Image files are converted into local `Blob` URLs using `URL.createObjectURL()`. **Critically, image data is never sent to the server.**
    *   The content of the annotation file is read into a plain text string.

3.  **AI Schema Generation (`extractEvalSchema`):**
    *   The text content of the annotation file is sent as input to a server-side Genkit flow defined in `src/ai/flows/extract-eval-schema.ts`.
    *   This flow uses the Gemini 1.5 Flash model to analyze the structure of the annotation data.
    *   **Output:** The AI returns a structured JSON object called `EvalSchema`, which contains:
        *   `labels`: A list of all unique object categories and their attributes.
        *   `matchKey`: (Optional) The name of an attribute that can serve as a unique identifier for annotations (e.g., `"Annotation No"` or `"track_id"`).
        *   `pseudoCode`: A human-readable summary of the derived evaluation logic.
        *   `biDirectionalMatching`: A boolean flag indicating if the more advanced matching algorithm is recommended for this dataset.

4.  **UI Update and Customization:**
    *   The `EvalSchema` object is stored in the component state of `src/app/page.tsx`.
    *   The `RuleConfiguration` component re-renders, displaying the labels, match key, and the editable pseudocode to the user.
    *   The user has the option to modify the evaluation logic by either editing the pseudocode directly or providing plain-text instructions, which triggers the `extractEvalSchema` flow again with the new context.

### 2.2. Phase 2: Evaluation Execution

This phase begins when the user uploads student files and clicks "Run Evaluation." All processing occurs entirely within the user's browser.

**Step-by-Step Breakdown:**

1.  **Input - Student & Image Files:** The user uploads one or more student annotation files (JSON, XML, or a ZIP archive containing multiple submissions). If images were not in the GT ZIP, they can be uploaded here.

2.  **File Parsing and Normalization:**
    *   The `handleEvaluate` function in `src/app/page.tsx` orchestrates this process.
    *   It uses `JSZip` to handle student ZIP archives, including nested ZIPs from CVAT batch exports.
    *   All annotation files are parsed into a standardized internal format (`CocoJson`). This is a critical step that makes the evaluation engine format-agnostic.
        *   `JSON.parse()` is used for `.json` files.
        *   Custom parsers (`parseCvatXml`, `parseCvatXmlForPolygons`) are used for `.xml` files.

3.  **Core Evaluation (`evaluateAnnotations`):**
    *   For each student file, the `evaluateAnnotations` function from `src/lib/evaluator.ts` is called.
    *   **Inputs:** The parsed GT data, the parsed student data, and the current `EvalSchema` from the application's state.
    *   The function executes the multi-pass matching algorithm (detailed in the next section).
    *   **Output:** It returns a comprehensive `EvaluationResult` object containing the final score, detailed metrics (IoU, accuracy), feedback messages, and categorized lists of matched, missed, and extra annotations.

4.  **Results Display:**
    *   The array of `EvaluationResult` objects (one for each student file) is stored in the application state.
    *   The `ResultsDashboard` component re-renders to display the results, including:
        *   A batch summary table with top-level scores for each student.
        *   A collapsible accordion for detailed, per-student reports.
        *   Visualizations of the annotations on the images via the `AnnotationViewer` component.

5.  **Data Export:** The user can download the results as a detailed, per-student CSV file or a summary CSV for the entire batch. This process is handled client-side by formatting the `EvaluationResult` object into a CSV string.

---

## 3. Algorithmic Evolution: From Greedy Match to Optimal Bipartite Matching

The credibility of the tool rests on the fairness and accuracy of its matching algorithm. The initial implementation used a simple greedy approach, which was fast but had significant flaws. It has been upgraded to a globally optimal bipartite matching algorithm.

### 3.1. The Original Algorithm: Greedy Best-Match (Legacy)

The original fallback mechanism (used when no unique `matchKey` was available) operated on a simple, greedy principle.

*   **How it Worked:**
    1.  The algorithm would iterate through each Ground Truth (GT) annotation one by one.
    2.  For each GT annotation, it would scan *all* unmatched student annotations.
    3.  It would permanently pair the GT annotation with the student annotation that had the highest Intersection over Union (IoU), as long as that IoU was above a fixed threshold (e.g., 0.5).
    4.  This process would repeat for the next GT annotation, but the "claimed" student annotation was no longer available for matching.

*   **Analysis & Weaknesses:**
    *   **Accuracy:** **Low to Medium**. In crowded scenes with overlapping objects, this method was prone to making suboptimal pairings. A GT box could be matched with a mediocre partner, preventing a much better potential partner from being assigned to another GT box, leading to a cascade of incorrect "missed" or "extra" classifications.
    *   **Performance:** **Fast**. The complexity was roughly `O(G * S)` per image, where `G` is the number of GT annotations and `S` is the number of student annotations. This was acceptable for sparse scenes but did not scale well.
    *   **Fairness:** **Low**. The matching outcome was highly dependent on the iteration order, which could feel arbitrary and unfairly penalize users.

### 3.2. The Current Algorithm: Optimal Bipartite Matching

To address the flaws of the greedy approach, the core logic was replaced with the **Hungarian algorithm**, a classic combinatorial optimization algorithm that guarantees the most optimal assignment between two sets.

*   **How it Works:**
    1.  **Problem Framing:** For a given image, the problem is no longer treated as a sequential search but as a single, global "assignment problem." We want to find the set of pairs (one GT, one student) that results in the best possible total score for the entire image.
    2.  **Cost Matrix Construction:** A cost matrix is built where rows represent the remaining GT annotations and columns represent the remaining student annotations. The value in each cell `(i, j)` represents the "cost" of matching GT annotation `i` with student annotation `j`.
        *   `Cost(i, j) = 1 - IoU(i, j)`
        *   The cost is inversely proportional to the IoU; a perfect overlap (IoU = 1.0) has a cost of 0.
        *   If the IoU is below the required threshold, the cost is set to a very large number (effectively `Infinity`) to make that pairing impossible.
    3.  **Hungarian Algorithm Execution:** The `munkres-js` library is used to run the Hungarian algorithm on this cost matrix. The algorithm efficiently finds the set of pairings that **minimizes the total cost** across the entire matrix.
    4.  **Result:** The output is a single, globally optimal set of one-to-one matches. There is no ambiguity and the iteration order does not matter.

*   **Code Implementation (`src/lib/evaluator.ts`):**

    ```typescript
    import munkres from 'munkres-js';

    function findOptimalMatches(
        gtAnns: BboxAnnotation[],
        studentAnns: BboxAnnotation[],
        iouThreshold: number
    ): { gtIndex: number; studentIndex: number; iou: number }[] {
        if (!gtAnns.length || !studentAnns.length) {
            return [];
        }

        // 1. Construct the cost matrix where cost = 1 - IoU
        const costMatrix = gtAnns.map(gt =>
            studentAnns.map(student => {
                const iou = calculateIoU(gt.bbox, student.bbox);
                // Assign a very high cost to pairs below the threshold to disallow them
                return iou >= iouThreshold ? 1 - iou : 1_000_000;
            })
        );

        // 2. Run the Hungarian algorithm to find the assignment with the minimum cost
        const assignments = munkres(costMatrix) as [number, number][];

        // 3. Process the results, filtering out invalid (high-cost) matches
        const matches: { gtIndex: number; studentIndex: number; iou: number }[] = [];
        for (const [gtIndex, studentIndex] of assignments) {
            const cost = costMatrix[gtIndex][studentIndex];
            if (cost < 1_000_000) { // Ensure the match is valid
                matches.push({
                    gtIndex,
                    studentIndex,
                    iou: 1 - cost, // Convert cost back to IoU
                });
            }
        }
        return matches;
    }
    ```

*   **Analysis & Improvements:**
    *   **Accuracy:** **High**. This method guarantees the most mathematically optimal set of matches based on IoU, eliminating the ambiguity and cascading errors of the greedy approach. This significantly improves the reliability and fairness of the evaluation, especially in dense or complex scenes.
    *   **Performance:** **Medium**. The Hungarian algorithm has a time complexity of `O(n³)`, where `n` is the larger of the number of GT or student annotations. For typical images with dozens of annotations, this is nearly instantaneous. For extreme cases with hundreds of annotations, it may be noticeably slower than the greedy method, but this is a necessary trade-off for the vast improvement in accuracy.
    *   **Fairness:** **High**. The result is deterministic and globally optimal, removing any element of randomness or order-dependency from the matching process.

### 3.3. Configurability and Control

The new algorithm is integrated as the default fallback mechanism. The `EvalSchema` can be extended with a `biDirectionalMatching: boolean` flag in the future to allow toggling this feature, but for now, it stands as the superior replacement for the previous greedy logic, ensuring all users benefit from the improved accuracy.

---

## 4. Evaluation Formula & Scoring Logic

The final score is a weighted average of four distinct metrics, each representing a different aspect of annotation quality. The score is scaled from 0 to 100.

**Final Score = (Detection Score * 0.4) + (Localization Score * 0.3) + (Label Score * 0.2) + (Attribute Score * 0.1)**

### 4.1. Detection Score (40% Weight)

*   **Purpose:** Measures how well the student identified the correct number of objects. It penalizes both missed objects (false negatives) and extra, incorrect objects (false positives).
*   **Algorithm:** **F-beta Score**, with `beta = 0.5`.
    *   **Precision** = `Matched / Total Student Annotations`
    *   **Recall** = `Matched / Total GT Annotations`
    *   **F-beta Formula**: `(1 + beta²) * (precision * recall) / ((beta² * precision) + recall)`
*   **Rationale:** The beta value is set to `0.5`, which weighs **precision more heavily than recall**. This means that adding extra, incorrect annotations is penalized more than missing an existing one. This choice encourages students to be more careful and avoid speculative annotations.

### 4.2. Localization Score (30% Weight)

*   **Purpose:** Measures the accuracy of bounding box placement.
*   **Algorithm:** **Average Intersection over Union (IoU)**.
    *   **IoU** is calculated for every matched pair of annotations.
    *   The **Localization Score** is the average of all these IoU values, scaled to 100.
*   **Rationale:** IoU is the industry standard for measuring how well two bounding boxes overlap. A score of 1.0 represents a perfect overlap.

### 4.3. Label Score (20% Weight)

*   **Purpose:** Measures whether the student correctly classified the objects.
*   **Algorithm:** **Label Accuracy**.
    *   **Formula**: `(Correctly Labeled Matches / Total Matched Annotations) * 100`
*   **Rationale:** This is a straightforward measure of classification correctness. It only considers annotations that were successfully matched, isolating the classification task from the detection task.

### 4.4. Attribute Score (10% Weight)

*   **Purpose:** Measures the accuracy of textual or categorical attributes associated with an annotation (e.g., license plate number, color).
*   **Algorithm:** **Average String Similarity (Levenshtein Distance)**.
    *   For each attribute specified in the `EvalSchema`, the system calculates the similarity between the GT and student text.
    *   The similarity is calculated using the Levenshtein distance, which measures the number of edits (insertions, deletions, substitutions) needed to change one string into the other. This score is normalized to a 0-1 range (where 1 is a perfect match).
    *   The **Attribute Score** is the average similarity across all compared attributes, scaled to 100.
*   **Rationale:** Using Levenshtein distance provides a nuanced text comparison that is robust to minor typos. For example, "licence" and "license" will have a high similarity score, whereas a simple equality check would fail. This provides a fairer assessment of attribute accuracy.
