
# Annotator AI: Scoring Plan & Methodology

**Version:** 2.0
**Date:** August 20, 2024

---

## 1. Overview

### 1.1 Purpose of the Scoring System

The primary goal of the Annotator AI scoring system is to provide a **fair, transparent, and comprehensive evaluation** of annotation quality. The system is designed to heavily reward the quality of work performed while still penalizing for incomplete or sloppy submissions.

### 1.2 Scoring Philosophy

The system is built on a **90/10 weighted blend of Quality and Completeness**.
-   **Quality (90%):** Measures how well a student annotated the items they found. It is the dominant component of the final score.
-   **Completeness (10%):** Measures whether the student found all required items and avoided adding unnecessary ones. It acts as a penalty/bonus modifier.

This approach prevents situations where a student who perfectly annotates one object but misses nine others can get a high score. It ensures that both accuracy and thoroughness are rewarded appropriately.

---

## 2. The Matching Process

Before scoring can begin, the system must intelligently pair Ground Truth (GT) annotations with Student annotations. This is done using a robust two-pass system for each image.

**Pass 1: Key-Based Matching (Deterministic)**
- The system first checks for a unique identifier (e.g., `Annotation No`) defined as a `matchKey` in the evaluation rules.
- It performs a direct one-to-one match for any GT and student annotations that share the same key value. This is the most reliable matching method.

**Pass 2: Optimal Assignment (Hungarian Algorithm)**
- For all annotations left unmatched, the system constructs a **cost matrix** where the cost of pairing any two annotations is `1 - IoU`.
- It then uses the **Hungarian algorithm** to find the set of pairs with the minimum possible total cost, guaranteeing the most mathematically optimal assignment. This is superior to "greedy" algorithms that can make early, suboptimal matches.

**Categorization:**
- **Matched:** A GT annotation successfully paired with a student annotation.
- **Missed:** A GT annotation that was left unpaired.
- **Extra:** A student annotation that was left unpaired.

---

## 3. Score Calculation

The final score is calculated based on the new 90/10 framework.

### 3.1 Component Scores (Per Matched Annotation)

For every **Matched** pair, the system first calculates three independent component scores, each scaled from 0 to 100:

1.  **IoU Score:** The raw Intersection over Union value, multiplied by 100.
2.  **Label Score:** The string similarity of the labels (e.g., "Car" vs "car"), multiplied by 100.
3.  **Attribute Score:** The average string similarity across all relevant attributes, multiplied by 100.

### 3.2 Quality Score (90% of Final Score)

The **Quality Score** represents the average quality of all annotations the student successfully completed.

**Step 1: Calculate the Quality Score for each individual match.**
This is a simple average of the three component scores.
`Match Quality = (IoU Score + Label Score + Attribute Score) / 3`

**Step 2: Calculate the overall Average Match Quality.**
This is the average of all the individual `Match Quality` scores. This value is what contributes 90% to the final grade.

### 3.3 Completeness Score (10% of Final Score)

The **Completeness Score** measures how thorough the submission was.

**Step 1: Calculate Precision and Recall.**
-   `Precision = Matched / (Matched + Extra)`
-   `Recall = Matched / (Matched + Missed)`

**Step 2: Calculate the F-beta Score.**
- The system uses an F-beta score with `beta=0.5`. This weighs precision more heavily than recall, discouraging students from making many low-quality "guesses."
-   `F-beta = (1 + 0.5²) * (Precision * Recall) / ((0.5² * Precision) + Recall)`

**Step 3: Scale to 100.**
- `Completeness Score = F-beta * 100`
- This value contributes 10% to the final grade.

### 3.4 Final Overall Score

The final score is the weighted sum of the Quality and Completeness scores.

`Final Score = (Average Match Quality * 0.90) + (Completeness Score * 0.10)`

---

## 4. Scoring Example

-   **Submission:** 2 Matched, 1 Missed, 1 Extra annotation.

### Step 1: Calculate Individual Match Quality

**Match 1:**
-   IoU Score = 95, Label Score = 100, Attribute Score = 100
-   `Match 1 Quality` = `(95 + 100 + 100) / 3` = **98.3**

**Match 2:**
-   IoU Score = 92, Label Score = 83, Attribute Score = 0
-   `Match 2 Quality` = `(92 + 83 + 0) / 3` = **58.3**

### Step 2: Calculate Average Match Quality

-   `Average Match Quality` = `(98.3 + 58.3) / 2` = **78.3**

### Step 3: Calculate Completeness Score

-   `Precision` = `2 / (2 + 1)` = 0.667
-   `Recall` = `2 / (2 + 1)` = 0.667
-   `F-beta_Score` = 0.665
-   `Completeness Score` = **66.5**

### Step 4: Calculate Final Overall Score

-   `Final Score` = `(78.3 * 0.90) + (66.5 * 0.10)`
-   `Final Score` = `70.47 + 6.65` = **77.12**
-   The student's final rounded score is **77**.

This score accurately reflects that the student did decent quality work on the annotations they found (`Quality` component) but were penalized for an incomplete submission (`Completeness` component).
