# Annotator AI: The Evaluation & Scoring Engine

This document provides a detailed technical explanation of the annotation matching and scoring algorithms used in Annotator AI. It covers the two-pass matching system, the formulas used for scoring, and the rationale for the final weighted scoring model.

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

## 2. Scoring Method (New Framework: 90% Quality / 10% Completeness)

The scoring system is designed to provide a holistic view of annotation quality, heavily favoring the quality of performed work while still penalizing for incompleteness.

### Individual Match "Quality" Score

For each `Matched` pair, an **Original Score** (0-100) is calculated. This score represents the overall quality of that specific annotation. It's an equal-parts blend of the three core metrics.

`Match Quality Score = (IoU% + Label% + Attribute%) / 3`

-   **IoU Score (IoU%)**: The raw Intersection over Union value, scaled to 100. This is the primary measure of geometric accuracy.
-   **Label Score (Label%)**: A similarity score (0 to 100) based on Levenshtein distance to check if the class labels match (e.g., 'car' vs 'Car').
-   **Attribute Score (Attribute%)**: The average similarity of all defined attributes for that label, calculated using Levenshtein distance.

This score is what appears in the results table and can be overridden by a trainer.

### Overall Submission Score

The final grade for the entire submission is a **90/10 blend** of overall annotation **Quality** and submission **Completeness**.

`Final Score = (Average_Match_Quality * 0.90) + (Completeness_Score * 0.10)`

-   **Average Match Quality (90% weight)**: This is the simple average of all **Final Scores** (including any manual overrides from the trainer) for every matched annotation. It answers the question: "What was the average quality of the work the student actually performed?"
-   **Completeness Score (10% weight)**: This is a score from 0-100 derived from the **F-beta score**. It measures how complete the student's work was by penalizing for missed and extra annotations.
    -   `Precision = Matched / (Matched + Extra)`
    -   `Recall = Matched / (Matched + Missed)`
    - We use a beta value of `0.5`, which weighs **precision higher than recall**. This is a deliberate choice to discourage users from "guessing" by creating many low-quality annotations.
    - `F-beta = (1 + β²) * (Precision * Recall) / (β² * Precision + Recall)`
    - `Completeness Score = F-beta * 100`

This framework ensures that high-quality work is the primary driver of the final score, while still applying a meaningful, but not overpowering, penalty for incomplete submissions.
