# Annotator AI: Technical Deep Dive & Project Documentation

## 1. Introduction & Core Purpose

Annotator AI is a specialized web application designed to automate and standardize the evaluation of image annotation tasks. In fields like computer vision and machine learning, accurately annotated datasets are the foundation for training reliable models. This tool addresses a common challenge in academic and professional training settings: the need for a consistent, objective, and efficient way to score the quality of annotations produced by students or junior annotators.

The core mission of Annotator AI is to bridge the gap between an expert-annotated "Ground Truth" (GT) dataset and a student's submission. It moves beyond simple pass/fail metrics to provide nuanced, actionable feedback, helping learners understand their mistakes and improve their skills. By ingesting standard annotation formats (COCO JSON and CVAT XML), the tool provides a flexible platform for various annotation projects, focusing initially on bounding box annotations.

A key innovation within this application is its hybrid evaluation model. It combines a deterministic, rule-based engine for objective scoring with a powerful, AI-driven schema extraction system. This allows the application to dynamically adapt its evaluation criteria based on the structure of the provided Ground Truth file, making it highly versatile.

### Key Features from a Technical Perspective:

*   **Dynamic Rule Generation:** Instead of relying on hardcoded evaluation logic, the application uses a Genkit AI flow (`extractEvalSchema`) to analyze the Ground Truth file. It identifies the object labels, their associated attributes (like `license_plate_number`), and a potential unique matching key, generating a human-readable pseudocode that defines the evaluation strategy for that specific task.
*   **Dual-Format Annotation Parsing:** The tool robustly handles two of the most common annotation formats: COCO JSON for bounding boxes and CVAT XML 1.1. It contains dedicated parsers that normalize these different formats into a single internal data structure (`CocoJson`), allowing the core evaluation logic to be format-agnostic.
*   **Rule-Based Evaluation Engine:** The primary evaluation is conducted by a sophisticated TypeScript module (`evaluator.ts`). This engine calculates Intersection over Union (IoU) for localization accuracy, compares labels for classification accuracy, and measures the similarity of textual attributes using the Levenshtein distance algorithm.
*   **Comprehensive Results Dashboard:** The results of the evaluation are presented in a rich, interactive dashboard. This includes a top-level score, detailed feedback messages, lists of matched, missed, and extra annotations, and granular accuracy metrics for localization, labels, and attributes.
*   **Modern, Component-Based Frontend:** The user interface is built with Next.js and React, leveraging the App Router for clean, server-rendered components. Styling is managed by Tailwind CSS, and the UI components are from the popular ShadCN UI library, ensuring a professional, consistent, and responsive user experience.
*   **Server-Side AI with Genkit:** All AI-related operations are handled by Genkit, Google's generative AI toolkit. This keeps heavy processing on the server, ensuring the client-side remains lightweight and responsive. AI is used smartly—not to perform the evaluation itself, but to configure the rules for the deterministic evaluation engine.

## 2. Technology Stack

The application is built on a modern, robust, and type-safe technology stack, chosen for its scalability, developer experience, and performance.

*   **Framework:** **Next.js 15** with the App Router. This is the foundation of the application. The App Router paradigm encourages the use of React Server Components (RSCs), which helps minimize the amount of JavaScript shipped to the client, leading to faster initial page loads. The entire application is structured around this router, with the main view located at `src/app/page.tsx`.
*   **Language:** **TypeScript**. The entire codebase is written in TypeScript, providing strong type safety. This is critical for an application that handles complex, nested data structures like annotation files. It helps prevent common runtime errors and makes the code more self-documenting and easier to maintain. Key data structures are explicitly defined in `src/lib/types.ts`.
*   **UI Components:** **ShadCN UI**. This is not a traditional component library but a collection of beautifully designed, reusable components built on top of Radix UI (for accessibility and headless logic) and Tailwind CSS (for styling). Components like `Card`, `Button`, `Table`, and `Tabs` are used throughout the application to build the UI, ensuring a consistent look and feel. The components are located in `src/components/ui`.
*   **Styling:** **Tailwind CSS**. A utility-first CSS framework that allows for rapid UI development without writing custom CSS. The application's theme, including primary colors, fonts, and spacing, is configured in `tailwind.config.ts` and the global styles (including CSS variables for theming) are in `src/app/globals.css`.
*   **Generative AI:** **Genkit**. Google's framework for building production-ready AI-powered features. Genkit is used to define, run, and manage the AI flow that extracts the evaluation schema from the Ground Truth file. The Genkit configuration and initialization can be found in `src/ai/genkit.ts`, and the specific AI logic is in `src/ai/flows/extract-eval-schema.ts`.
*   **Schema Definition & Validation:** **Zod**. A TypeScript-first schema declaration and validation library. Zod is used extensively within the Genkit flows to define the expected input and output structure of the AI models. This ensures that the data returned by the AI is in a predictable format that the application can safely use, preventing errors from malformed AI responses.

## 3. Project Structure Deep Dive

The project follows a standard Next.js App Router structure, with logical separation of concerns.

*   **`/` (Root)**
    *   `next.config.ts`: Configuration for the Next.js framework.
    *   `package.json`: Lists all project dependencies and scripts.
    *   `tailwind.config.ts`: Configuration for Tailwind CSS, including theme extensions.
    *   `tsconfig.json`: TypeScript compiler options.
    *   `components.json`: Configuration file for ShadCN UI, defining paths and component settings.

*   **`/src`**
    *   This is the main application source directory.

*   **`/src/app`**
    *   This directory is central to the Next.js App Router.
    *   `layout.tsx`: The root layout of the application. It defines the main `<html>` and `<body>` tags and wraps all pages. It's where global styles, fonts, and providers like the `Toaster` are included.
    *   `globals.css`: Global styles and Tailwind CSS layers. It's also where the CSS variables for the entire application's color theme are defined for both light and dark modes.
    *   `page.tsx`: This is the main entry point and the single page of the application. It's a client component (`'use client'`) because it manages a significant amount of state, including the uploaded files, evaluation results, and loading statuses. It orchestrates the entire evaluation process, calling the AI flows and the evaluation engine.

*   **`/src/components`**
    *   This directory contains all the React components that make up the UI.
    *   `/ui`: This subdirectory holds the base UI components provided by ShadCN UI (e.g., `button.tsx`, `card.tsx`). These are generally not modified directly but are used to compose more complex components.
    *   `EvaluationForm.tsx`: A critical client component containing the main form for uploading the GT and student annotation files. It uses `react-hook-form` and `zod` for client-side form validation.
    *   `ResultsDashboard.tsx`: A component responsible for displaying the entire evaluation output. It conditionally renders a placeholder, a loading skeleton, or the detailed results (score, feedback, tables) based on the application's state. It also contains the logic for downloading the results as a CSV file.
    *   `RuleConfiguration.tsx`: This component displays the dynamically generated evaluation rules from the GT file, including the labels, attributes, and pseudocode.
    *   `ScoreCard.tsx`: A visual component that displays the final score in a circular progress bar.
    *   `AnnotatorAiLogo.tsx`: The application's SVG logo.

*   **`/src/lib`**
    *   This directory is for library code, utility functions, type definitions, and core business logic.
    *   `utils.ts`: Contains utility functions, most notably the `cn` function from ShadCN, which merges Tailwind CSS classes.
    *   `types.ts`: **A crucial file** that defines the TypeScript interfaces for all major data structures used in the app, such as `FormValues`, `CocoJson`, `BboxAnnotation`, and `EvaluationResult`. This ensures type safety across the entire application.
    *   `evaluator.ts`: **The heart of the rule-based evaluation logic.** This module is a pure TypeScript function (`evaluateAnnotations`) that takes the parsed GT and student data and performs the detailed comparison. It calculates IoU, matches annotations, compares labels and attributes, and computes the final score and feedback.
    *   `cvat-xml-parser.ts`: A dedicated module for parsing CVAT 1.1 XML annotation files. It uses the browser's native `DOMParser` to traverse the XML tree and transform it into the application's internal `CocoJson` format. This normalization is key to allowing the evaluator to handle both JSON and XML inputs seamlessly.

*   **`/src/ai`**
    *   This directory contains all the logic related to Generative AI.
    *   `genkit.ts`: The initialization file for Genkit. It configures the necessary plugins (like `googleAI`) and exports the configured `ai` object that is used to define flows and prompts throughout the AI-related parts of the application.
    *   `/flows`: This subdirectory holds the specific Genkit flows.
        *   `extract-eval-schema.ts`: This server-side module (`'use server'`) defines the Genkit flow responsible for generating the evaluation rules. It defines the input schema (`EvalSchemaInput`), the desired output schema (`EvalSchema`) using Zod, and a detailed prompt that instructs the Gemini model on how to analyze the GT file content and extract the required information (labels, attributes, pseudocode).

*   **`/src/hooks`**
    *   This directory contains custom React hooks.
    *   `use-toast.ts`: A custom hook for managing toast notifications, providing a clean API to show success or error messages to the user.

## 4. The End-to-End Evaluation Flow

Understanding the flow of data and logic from user interaction to final result is key to understanding the application.

### Step 1: Ground Truth File Upload and Rule Generation

1.  **User Interaction:** The user clicks the "Upload" input in the `EvaluationForm` component to select their Ground Truth (GT) file.
2.  **Event Handling:** The `onChange` event on the file input in `EvaluationForm.tsx` is triggered. This event calls the `onGtFileChange` prop, which is a function passed down from the main `page.tsx`.
3.  **Initiating AI Flow:** In `page.tsx`, the `handleGtFileChange` function takes over. It sets the `isGeneratingRules` state to `true` to show loading indicators. It reads the content of the uploaded file into a string.
4.  **Calling the Genkit Flow:** The function then calls `extractEvalSchema({ gtFileContent: fileContent })`. This is a server action that invokes the Genkit flow defined in `src/ai/flows/extract-eval-schema.ts`.
5.  **AI Processing:** The Genkit flow sends the file content and the structured Zod schema to the Gemini Pro model. The model analyzes the text (whether JSON or XML) and returns a JSON object that conforms to the `EvalSchema`.
6.  **State Update:** The returned schema is received back in `page.tsx`. It is stored in the `evalSchema` state variable. A success toast is displayed.
7.  **UI Update:** The `RuleConfiguration` component, which receives `evalSchema` as a prop, re-renders to display the newly generated labels, attributes, and pseudocode.

### Step 2: Running the Evaluation

1.  **User Interaction:** The user uploads a student file and clicks the "Run Evaluation" button in the `EvaluationForm`.
2.  **Form Submission:** The form's `onSubmit` handler is called, which in turn calls the `onEvaluate` prop, passing the form data to `page.tsx`.
3.  **Initiating Evaluation:** The `handleEvaluate` function in `page.tsx` begins. It sets the `isLoading` state to `true`.
4.  **File Parsing:**
    *   It reads both the GT and student files into text strings.
    *   It performs a check (`content.trim().startsWith('<?xml')`) to determine if the files are XML.
    *   If they are XML, it uses the `parseCvatXml` function from `src/lib/cvat-xml-parser.ts` to convert them into the internal `CocoJson` format.
    *   If they are not XML, it assumes they are JSON and uses `JSON.parse()`. This creates a unified data structure for the next step.
5.  **Calling the Evaluator:** The core function `evaluateAnnotations` from `src/lib/evaluator.ts` is called. It is passed the parsed GT JSON, the parsed student JSON, and the `evalSchema` that was generated in Step 1.
6.  **Rule-Based Comparison (Inside `evaluator.ts`):**
    *   **Annotation Grouping:** The function first groups all annotations from both files by their `image_id` to ensure it only compares annotations within the same image.
    *   **Matching Pass 1 (Key-Based):** If the `evalSchema` provided a `matchKey` (e.g., "Annotation No"), the evaluator loops through the GT annotations. For each one, it looks for a student annotation in the same image that has the exact same value for that key. This is the most reliable way to match objects.
    *   **Matching Pass 2 (IoU-Based):** For any GT annotations that were not matched by key, the evaluator performs a fallback search. It calculates the Intersection over Union (IoU) with all remaining (unmatched) student annotations in the same image. If it finds a pair with an IoU above a certain threshold (e.g., 0.5), it considers them a match.
    *   **Metric Calculation:** For every matched pair, the engine calculates:
        *   The IoU score.
        *   If the labels match.
        *   The similarity of any text attributes (defined in the schema) using Levenshtein distance.
    *   **Categorization:** After the matching passes, any GT annotations without a match are categorized as `missed`. Any student annotations without a match are categorized as `extra`.
    *   **Scoring:** A final score is calculated using a weighted average of several metrics: detection accuracy (a blend of precision and recall), localization accuracy (average IoU), label accuracy, and attribute accuracy.
7.  **State and UI Update:**
    *   The `evaluateAnnotations` function returns a comprehensive `EvaluationResult` object.
    *   Back in `page.tsx`, this result object is stored in the `results` state variable.
    *   The `ResultsDashboard` component receives the `results` object and re-renders, displaying the final score, feedback messages, and the detailed tables of matched, missed, and extra annotations. The loading state is set to `false`.

### Step 3: Downloading Results

1.  **User Interaction:** The user clicks the "Download CSV" button in the `ResultsDashboard`.
2.  **CSV Generation:** The `handleDownloadCsv` function inside `ResultsDashboard.tsx` is executed.
3.  **Data Serialization:** It manually constructs a long CSV string. It iterates through the `results` object (which is in component state) and formats the summary, matched, missed, and extra annotation data into CSV rows. It includes detailed information, such as annotation IDs, labels, and all attributes.
4.  **Triggering Download:** The function creates a `data:` URI with the CSV content, creates a temporary `<a>` element, sets the `href` and `download` attributes, programmatically clicks it to open the browser's save dialog, and then removes the temporary element.

This entire flow demonstrates a clean separation of concerns: `page.tsx` acts as the central controller, `EvaluationForm` handles user input, `evaluator.ts` contains the pure business logic, the AI flow handles dynamic configuration, and `ResultsDashboard` is responsible for data presentation.
