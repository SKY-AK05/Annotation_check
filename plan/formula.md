
# Annotation Scoring Methodology: `Formula.md`

This document provides a comprehensive, technical deep-dive into the scoring algorithm used by the Annotator AI tool. It is intended for developers, data scientists, and power users who need to understand the precise mechanics of the evaluation process.

---

### **Checklist of Actions**

-   [x] **Section 1: Algorithm Overview** - Detail the end-to-end scoring process.
-   [x] **Section 2: Score Normalization** - Clarify how scores are scaled.
-   [x] **Section 3: Formula Description** - List and define all mathematical formulas used.
-   [x] **Section 4: Score Distribution** - Explain how scores are assigned and aggregated.
-   [x] **Section 5: Example Calculation** - Provide a step-by-step practical example.
-   [x] **Section 6: Visual Representations** - Include a flowchart of the scoring logic.
-   [x] **Section 7: Limitations and Biases** - Address potential shortcomings of the system.
-   [x] **Section 8: Score Table** - Provide a summary table of score components.
-   [x] **Section 9: References** - List sources that informed the methodology.

---

## 1. Scoring Algorithm Overview

The scoring mechanism is designed to provide a balanced and fair assessment of an annotator's performance by holistically evaluating three core aspects of their work: **Localization Accuracy** (how well boxes are drawn), **Classification Accuracy** (whether the correct labels and attributes are used), and **Completeness** (whether all required objects are annotated without adding unnecessary ones).

The final score is a weighted blend of two primary components: **Quality** and **Completeness**.

-   **Quality (90% of Final Score):** This metric assesses the correctness of the annotations that the student *did* create and that could be matched to a ground truth annotation. It is itself an average of three sub-metrics: IoU, Label Similarity, and Attribute Similarity. This prevents a student from getting a high score simply by drawing good boxes while assigning incorrect labels.

-   **Completeness (10% of Final Score):** This metric assesses whether the student annotated all the required objects without adding extra, incorrect ones. It uses an **F-beta score (with β=0.5)**, which is a standard metric that combines precision and recall, placing a slightly higher emphasis on precision to discourage guessing.

The algorithm proceeds as follows:
1.  **Matching:** For each image, the system first attempts to match student annotations to ground truth annotations using a **unique key** (if one is defined in the schema, e.g., "Annotation No"). For any remaining unmatched annotations, it uses the **Hungarian (Munkres) algorithm** to find the optimal pairings based on maximizing the Intersection over Union (IoU), ensuring that each annotation can only be part of one match.
2.  **Individual Scoring:** Each matched pair is scored for Quality based on IoU, label correctness, and attribute correctness.
3.  **Aggregation:** The system calculates the average Quality score across all matched annotations. It also calculates the overall Completeness score based on the total counts of matched, missed, and extra annotations across all images.
4.  **Final Calculation:** The final score is computed using the `(Quality * 0.90) + (Completeness * 0.10)` formula.

## 2. Score Normalization

All primary scoring components (IoU, Label Similarity, Attribute Similarity, F-beta) are inherently normalized to a scale of **0.0 to 1.0**. These values are then multiplied by 100 to be presented as a more intuitive `0-100` score. No further statistical normalization (e.g., z-scores, curving) is applied, as the goal is to assess absolute performance against the ground truth, not relative performance against other students.

- **Effect:** This direct scaling ensures that a score of `85` means the student achieved 85% of the possible points according to the defined weights and logic, making the results transparent and easy to interpret.

## 3. Formula Description

The following formulas are used in the evaluation process:

1.  **Intersection over Union (IoU)**
    -   **Equation:** `IoU = Area_of_Overlap / Area_of_Union`
    -   **Variables:**
        -   `Area_of_Overlap`: The area of the rectangle where the student and ground truth bounding boxes intersect.
        -   `Area_of_Union`: The total area covered by both boxes, calculated as `Area(Box1) + Area(Box2) - Area_of_Overlap`.
    -   **Source:** Calculated geometrically from the bounding box coordinates of a matched pair.

2.  **String Similarity (Normalized Levenshtein Distance)**
    -   **Equation:** `Similarity = (Max_Length - Levenshtein_Distance) / Max_Length`
    -   **Variables:**
        -   `Max_Length`: The length of the longer of the two input strings.
        -   `Levenshtein_Distance`: The minimum number of single-character edits (insertions, deletions, or substitutions) required to change one string into the other.
    -   **Source:** Used to compare labels and attribute values. Calculated between the GT and student strings.

3.  **Quality Score (per match)**
    -   **Equation:** `Quality_Match = (IoU + Label_Similarity + Attribute_Similarity) / 3`
    -   **Variables:**
        -   `IoU`: The IoU score for the matched pair (0-1).
        -   `Label_Similarity`: The string similarity of the labels (0 or 1, since labels must match exactly).
        -   `Attribute_Similarity`: The average string similarity across all applicable attributes for the pair.
    -   **Source:** Calculated for each matched annotation pair.

4.  **Completeness (F-beta Score)**
    -   **Equation:** `F_beta = (1 + β²) * (Precision * Recall) / (β² * Precision + Recall)` where `β = 0.5`.
    -   **Variables:**
        -   `Precision = Matched / (Matched + Extra)`
        -   `Recall = Matched / (Matched + Missed)`
        -   `Matched`, `Missed`, `Extra`: The total counts of annotations in each category across all images.
    -   **Source:** Calculated from the aggregated counts of all annotations for a student.

5.  **Final Score**
    -   **Equation:** `Final_Score = (0.90 * Avg_Quality_Score) + (0.10 * Completeness_Score)`
    -   **Variables:**
        -   `Avg_Quality_Score`: The average of all individual `Quality_Match` scores, multiplied by 100.
        -   `Completeness_Score`: The F-beta score, multiplied by 100.
    -   **Source:** The final calculation step.

## 4. Score Distribution

-   **Per Matched Annotation:** Each matched annotation receives a `Quality` score between 0 and 100, derived from the average of its IoU, Label, and Attribute scores.
-   **Per Missed/Extra Annotation:** These are not scored individually. Instead, they contribute to the `Completeness` score by decreasing `Recall` (for missed) and `Precision` (for extra). A high number of missed or extra items will significantly lower the F-beta score, thereby penalizing the final score.
-   **Total Score Derivation:** The total score is not a simple sum. It's a weighted aggregate where 90% of the score comes from the *average quality* of the work done, and 10% comes from the *completeness* of the submission.

## 5. Example Calculation

**Scenario:**
- **Ground Truth:** 2 annotations ("car", "truck").
- **Student Submission:** 3 annotations ("car", "trunk", "bus").
- **Results:**
    - The student "car" is matched to the GT "car" with **IoU = 0.9**.
    - The student "trunk" is matched to the GT "truck" with **IoU = 0.8**.
    - The student "bus" is an **extra** annotation.

**Step-by-step Calculation:**

1.  **Score Match 1 ("car" vs "car"):**
    -   IoU Score: `0.9`
    -   Label Score: `1.0` (Perfect match)
    -   Attribute Score: `1.0` (Assume no attributes for simplicity)
    -   **Quality_1** = `(0.9 + 1.0 + 1.0) / 3 = 0.967`

2.  **Score Match 2 ("truck" vs "trunk"):**
    -   IoU Score: `0.8`
    -   Label Score: `0.8` (String similarity for "truck" vs "trunk" is 4/5)
    -   Attribute Score: `1.0`
    -   **Quality_2** = `(0.8 + 0.8 + 1.0) / 3 = 0.867`

3.  **Calculate Average Quality Score:**
    -   `Avg_Quality_Score = (Quality_1 + Quality_2) / 2 = (0.967 + 0.867) / 2 = 0.917`
    -   Scaled to 100: **91.7**

4.  **Calculate Completeness Score:**
    -   Matched = 2, Missed = 0, Extra = 1
    -   Precision = `2 / (2 + 1) = 0.667`
    -   Recall = `2 / (2 + 0) = 1.0`
    -   F-beta (β=0.5) = `(1.25 * 0.667 * 1.0) / (0.25 * 0.667 + 1.0) = 0.83375 / 1.16675 = 0.715`
    -   Scaled to 100: **71.5**

5.  **Calculate Final Score:**
    -   `Final_Score = (0.90 * 91.7) + (0.10 * 71.5)`
    -   `Final_Score = 82.53 + 7.15 = 89.68`
    -   **Final Rounded Score: 90**

## 6. Visual Representations

### Score Calculation Flowchart (Mermaid)

```mermaid
graph TD
    subgraph Input Data
        A[Ground Truth Annotations]
        B[Student Annotations]
    end

    subgraph Pre-processing
        C{For each image};
    end
    
    subgraph Matching Logic
        D{Match by Unique Key};
        E{Match Remaining by IoU using Hungarian Algorithm};
    end

    subgraph Scoring per Match
        F[Calculate IoU];
        G[Calculate Label Similarity];
        H[Calculate Attribute Similarity];
        I[Avg_Quality = (F+G+H)/3];
    end

    subgraph Aggregation
        J[Aggregate all Matched, Missed, Extra annotations];
        K[Calculate Average Quality Score across all matches];
        L[Calculate Completeness Score using F-beta];
    end

    subgraph Final Score
        M[Final Score = (Avg Quality * 0.9) + (Completeness * 0.1)];
    end

    A --> C;
    B --> C;
    C --> D;
    D -- Unmatched --> E;
    E -- Matched Pairs --> F;
    E -- Matched Pairs --> G;
    E -- Matched Pairs --> H;
    F & G & H --> I;
    I --> J;
    D -- Matched Pairs --> F;
    D -- Matched Pairs --> G;
    D -- Matched Pairs --> H;
    E -- Unmatched --> J
    J --> K;
    J --> L;
    K & L --> M;

```

## 7. Limitations and Biases

-   **Sensitivity to IoU Threshold:** The initial matching is dependent on the IoU threshold (currently 0.5). A poorly drawn student box might fall below this threshold and be incorrectly classified as a "miss" and an "extra" rather than a "match" with a low IoU, which can disproportionately affect the score.
-   **Binary Label Matching:** String similarity is used for attribute values, but labels are expected to be an exact match (or very close). A simple typo could result in a 0 for label similarity, which may be too harsh. The current system mitigates this with Levenshtein distance but complex variations might not be handled perfectly.
-   **No Partial Credit for Attributes:** Attribute scoring is binary for many types (e.g., dropdowns). There is no concept of a "close" but incorrect attribute.
-   **Uniform Weighting:** The system assumes all attributes for a given label are equally important. It does not support assigning higher weights to more critical attributes (e.g., "is_emergency_vehicle" being more important than "color").

## 8. Score Table

This table summarizes how different events contribute to the final score components.

| Event Type                          | Quality Component                               | Completeness Component                            |
| ----------------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| **Annotation is Matched**           | Score is calculated based on IoU, Label, & Attrs. | Increases `Matched` count (improves score)        |
| **Annotation is Missed**            | No contribution.                                | Increases `Missed` count (reduces `Recall`)     |
| **Annotation is Extra**             | No contribution.                                | Increases `Extra` count (reduces `Precision`)   |
| **Label is incorrect on a Match**   | Reduces the `Label Similarity` part of Quality.   | No direct effect.                                 |
| **Attribute is incorrect on a Match** | Reduces the `Attribute Similarity` part of Quality. | No direct effect.                                 |

## 9. References

-   **Intersection over Union (IoU):** A standard metric in object detection. [Further Reading](https://www.pyimagesearch.com/2016/11/07/intersection-over-union-iou-for-object-detection/)
-   **Hungarian (Munkres) Algorithm:** Used for solving the assignment problem to find optimal pairings between GT and student annotations. [Wikipedia](https://en.wikipedia.org/wiki/Hungarian_algorithm)
-   **F-beta Score:** A standard metric for evaluating the accuracy of a test, which combines precision and recall. [Wikipedia](https://en.wikipedia.org/wiki/F-score)
-   **Levenshtein Distance:** Used for measuring the difference between two sequences. [Wikipedia](https://en.wikipedia.org/wiki/Levenshtein_distance)
