# Todo: Fix Attribute Scoring Logic

**Objective:** The annotation tool is failing to check and score attributes from datasets, resulting in an inaccurate 100% attribute score. The goal is to correct the evaluation logic to ensure all relevant attributes are compared.

---

### Investigation Plan

-   [ ] **1. Re-examine `cvat-xml-parser.ts`:** Although I've worked on this file before, I will start by re-verifying that it correctly parses *all* attributes for each annotation and that there are no case-sensitivity issues with attribute names.
-   [ ] **2. Deep-dive into `evaluator.ts`:** This is the most likely location of the error. I will trace the `calculateMatchQuality` function and the attribute comparison loop within it. The key is to understand why the loop that calculates `pairAttributeSimilarity` is being skipped or is not finding the correct attributes to compare.
-   [ ] **3. Analyze Dependency on `EvalSchema`:** I will confirm that the evaluator's logic for attribute checking does not incorrectly rely on the `EvalSchema`. The system should compare any attributes that exist on both the GT and student annotations for a matched pair, even if they aren't explicitly listed in the schema.

---

### Implementation Plan

-   [ ] **4. Correct `evaluator.ts` Logic:** Based on the investigation, I will modify the attribute-scoring loop in `evaluator.ts`. The fix will likely involve ensuring the loop correctly identifies which attributes to compare based on what's present in the Ground Truth annotation, rather than relying on a potentially incomplete schema.
-   [ ] **5. Update Documentation (If Necessary):** If the fix changes any part of the scoring logic in a way that impacts the user, I will update `plan/formula.md` to reflect the change.
-   [ ] **6. Prepare for Review:** I will bundle the corrected `evaluator.ts` file and any other modified files into a final response for your approval.

---

### Review

-   [ ] **Summary of Changes:** (To be filled in after implementation)
-   [ ] **Verification Steps:** (To be filled in after implementation)
