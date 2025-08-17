# Annotator AI: Recent Changes & Enhancements

This document summarizes the major architectural improvements and feature updates implemented in the Annotator AI tool over the last development cycle.

---

### **1. Core Architectural Rework: Web Worker Integration**

To address a critical performance bottleneck, the application's core evaluation logic was moved off the main UI thread and into a dedicated Web Worker.

*   **Problem Solved:** Previously, all file parsing (including ZIP decompression) and the entire annotation evaluation process ran on the main browser thread. This caused the user interface to freeze and become unresponsive when processing large files or batch evaluations with many student submissions.

*   **Implementation Details:**
    *   A new `evaluation.worker.ts` file was created to house all heavy-duty processing.
    *   The main page component (`page.tsx`) was refactored to delegate the evaluation task to this worker.
    *   A clear `postMessage` protocol was established for communication, allowing the UI to send raw file data to the worker and receive structured messages back.
    *   The worker now handles all ZIP file decompression, XML/JSON parsing, and the core evaluation loop (`evaluateAnnotations`).

*   **Key Benefit:** The UI now remains **100% responsive** during evaluations. Users can interact with the application, and animations (like spinners) remain smooth, significantly improving the user experience and making the tool feel more professional and reliable.

---

### **2. Feature Enhancement: Editable Scores & Persistence**

A new feature was added to allow trainers to manually override the automated scores for any matched annotation, providing essential human-in-the-loop validation.

*   **Problem Solved:** Automated scoring, while efficient, may not always capture the nuance of a complex annotation. Trainers needed the ability to correct or adjust scores based on their expert judgment.

*   **Implementation Details:**
    *   A new `EditableScoreCell.tsx` component was created. This component displays the score and becomes an input field when clicked.
    *   It visually distinguishes between the `originalScore` and the `overrideScore` (e.g., by striking through the original).
    *   Score overrides are persisted in the browser's **`localStorage`**, so they are not lost when the user refreshes the page.
    *   The core evaluation logic was updated with a `recalculateOverallScore` function that applies any existing overrides to provide an instant update to the student's final score.
    *   The detailed CSV export was updated to include columns for both the original and final (overridden) scores.

*   **Key Benefit:** This gives trainers full control over the final evaluation, increasing the tool's accuracy and utility in a real-world training or quality assurance setting.

---

### **3. UI Improvement: Real-Time Progress Bar**

To complement the Web Worker integration, a visual progress bar was added to provide clear feedback during batch evaluations.

*   **Problem Solved:** When processing a large ZIP archive of student files, users had no indication of the evaluation's progress, making it difficult to know if the process was working or stuck.

*   **Implementation Details:**
    *   The Web Worker now sends `PROGRESS` messages back to the main UI thread after processing each file in a batch.
    *   These messages include the number of completed files, the total number of files, and the name of the file currently being processed.
    *   The UI listens for these messages and updates a new `ProgressBar` component in real-time.

*   **Key Benefit:** Users now have clear, granular feedback during long-running tasks, which improves confidence and reduces perceived wait times.

---

### **4. Documentation Overhaul**

All key project markdown files (`README.md`, `bottleneck.md`, `features.md`) were updated to reflect the new architectural changes.

*   A new document, `formula.md`, was created to provide a detailed, technical deep-dive into the scoring algorithm, including a comparison between the old "Greedy" method and the current, more robust **Hungarian algorithm**.
*   The `README.md` was enhanced with a new, non-technical "Score Calculation" section to explain the scoring logic to all users.
