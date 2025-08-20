# Annotator AI: The Evaluation & Scoring Engine

This document provides a detailed technical explanation of the annotation matching and scoring algorithms used in Annotator AI. It covers the current two-pass system, the formulas used for scoring, and the rationale for the weighted scoring model.

---

## 1. The Evaluation Process: A Two-Pass System

To ensure the most fair and accurate pairing of annotations, the system uses a **two-pass matching system** for each image being evaluated.

### Step-by-Step Process

1.  **Data Preparation**: For a given image, the system gathers all Ground Truth (GT) annotations and all student annotations.
2.  **Pass 1: Key-Based Matching (Deterministic)**
    - The system first checks if a `matchKey` (e.g., a unique ID like "Annotation No") was defined in the **Evaluation Rules**.
    - If a key exists, it finds one-to-one matches between GT and student annotations that share the exact same value for that key.
    - This is the most reliable matching method. All annotations paired in this pass are considered "matched" and are removed from the pool for the next pass.
3.  **Pass 2: Optimal Matching (Hungarian Algorithm)**
    - For all remaining (unmatched) GT and student annotations, the system constructs a **cost matrix**. Each cell `(i, j)` in the matrix represents the "cost" of matching GT annotation `i` with student annotation `j`.
    - The cost is calculated as `1 - IoU(i, j)`. A perfect match (IoU = 1.0) has a cost of 0, while a non-overlapping match (IoU = 0.0) has a cost of 1.
    - The **Hungarian algorithm** is then used to find the set of pairs that results in the **minimum possible total cost**. This guarantees the most optimal assignment of pairs across the entire image.
4.  **Categorization**:
    - **Matched**: Any GT annotation that was successfully paired with a student annotation in either Pass 1 or Pass 2.
    - **Missed**: Any GT annotation that was left unpaired after both passes.
    - **Extra**: Any student annotation that was left unpaired after both passes.
5.  **Scoring**: The system then calculates scores for each matched pair and aggregates them into an overall submission score.

---

## 2. Scoring Method

The scoring system is designed to provide a holistic view of annotation quality, balancing localization, classification, and attribute accuracy.

### Individual Match Score

For each `Matched` pair, an **Original Score** (0-100) is calculated using a weighted formula designed to provide a fair distribution of scores.

`Match Score = (IoU * 70) + (Label_Similarity * 15) + (Attribute_Similarity * 15)`

-   **IoU (70% weight)**: The raw Intersection over Union value, scaled. A perfect overlap (IoU=1.0) contributes 70 points. This is the primary measure of geometric accuracy.
-   **Label Similarity (15% weight)**: A similarity score (0 to 1) calculated using Levenshtein distance to check if the class labels match (e.g., 'car' vs 'Car'). A perfect match contributes 15 points.
-   **Attribute Similarity (15% weight)**: The average similarity of all defined attributes for that label (e.g., 'color', 'occluded'), calculated using Levenshtein distance for robust string comparison. An average similarity of 100% contributes 15 points.

### Overall Submission Score

The final grade for the entire submission is a 50/50 blend of **quality** and **completeness**:

`Overall Score = (Avg_Match_Quality * 0.5) + (F-beta_Score * 0.5)`

-   **Average Match Quality (50% weight)**: This is the simple average of all **Final Scores** (including any manual overrides from the trainer) for every matched annotation. It answers the question: "How good was the work the student actually did?"
-   **F-beta Score (50% weight)**: This is a standard industry metric that balances precision and recall to measure how complete the student's work was. It penalizes for missed and extra annotations.
    -   `Precision = Matched / (Matched + Extra)`
    -   `Recall = Matched / (Matched + Missed)`
    - We use a beta value of `0.5`, which weighs **precision higher than recall**. This is a deliberate choice to discourage users from "guessing" by creating many low-quality annotations to try and improve their score.

---

## 3. Walkthrough Example

Let's assume a student submission has the following results:

-   **Matched Annotations**: 2
-   **Missed Annotations**: 1
-   **Extra Annotations**: 1

#### Step 1: Calculate Individual Match Scores

-   **Match 1**:
    -   IoU = 0.95
    -   Label Similarity = 1.0 (Perfect match)
    -   Attribute Similarity = 1.0 (Perfect match)
    -   **Score 1** = `(0.95 * 70) + (1.0 * 15) + (1.0 * 15)` = `66.5 + 15 + 15` = **96.5**

-   **Match 2**:
    -   IoU = 0.90
    -   Label Similarity = 1.0 (Perfect match)
    -   Attribute Similarity = 0.80 (e.g., a typo in an attribute)
    -   **Score 2** = `(0.90 * 70) + (1.0 * 15) + (0.80 * 15)` = `63 + 15 + 12` = **90.0**

#### Step 2: Calculate Average Match Quality

-   `Avg_Match_Quality` = `(96.5 + 90.0) / 2` = **93.25**

#### Step 3: Calculate Completeness (F-beta Score)

-   `Precision` = `2 / (2 + 1)` = 0.667
-   `Recall` = `2 / (2 + 1)` = 0.667
-   `F-beta_Score (beta=0.5)` = `(1 + 0.5²) * (0.667 * 0.667) / ((0.5² * 0.667) + 0.667)` = `1.25 * 0.444 / (0.167 + 0.667)` = `0.555 / 0.834` = 0.665
-   Scaled to 100 points, `F-beta_Score` = **66.5**

#### Step 4: Calculate Final Overall Score

-   `Overall Score` = `(Avg_Match_Quality * 0.5) + (F-beta_Score * 0.5)`
-   `Overall Score` = `(93.25 * 0.5) + (66.5 * 0.5)`
-   `Overall Score` = `46.625 + 33.25` = **79.875**
-   **Final Rounded Score: 80**

This final score provides a much more accurate picture of the student's performance, as it correctly penalizes for the missed annotation and the extra annotation, which a simple average of match quality would have ignored.
