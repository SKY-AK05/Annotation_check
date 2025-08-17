
# Annotator AI: Intelligent Image Annotation Evaluation

A powerful, in-browser tool for evaluating image annotations with detailed, AI-driven, and rule-based feedback.

## ✨ Features

Annotator AI provides a robust suite of features designed to make the evaluation of image annotation quality fast, accurate, and insightful.

*   **📊 Batch Evaluation**: Seamlessly upload and evaluate multiple student annotation files at once against a single ground truth file. The tool is optimized for workflows common in academic settings and data labeling quality assurance.
*   **🧩 Multiple Annotation Formats**: Native support for various annotation types to cover diverse use cases:
    *   **Bounding Boxes**: For object detection tasks.
    *   **Polygons**: For precise segmentation tasks.
    *   **Skeletons/Keypoints**: For pose estimation and landmark detection.
*   **📂 Rich Data Format Support**: Works with the most popular annotation formats in the computer vision ecosystem, ensuring easy integration with your existing tools:
    *   **COCO (JSON)**: The industry standard for object detection and segmentation datasets.
    *   **CVAT (XML 1.1)**: A widely used format from the popular CVAT annotation tool.
    *   **ZIP Archives**: For convenience, upload a single ZIP file containing both the annotation file (`.json` or `.xml`) and all associated images. The tool will automatically parse the contents.
*   **💯 Comprehensive Scoring Engine**: Go beyond simple IoU. The tool calculates a holistic score based on a weighted average of multiple critical metrics:
    *   **Localization Accuracy (IoU/OKS)**: Measures the overlap for bounding boxes (Intersection over Union) or keypoint similarity for skeletons (Object Keypoint Similarity).
    *   **Label Accuracy**: Checks if the object class assigned by the student matches the ground truth.
    *   **Attribute Similarity**: Compares the values of custom attributes (e.g., 'color', 'occluded') using Levenshtein distance for robust text comparison.
    *   **Precision & Recall**: Identifies and penalizes for missed (false negatives) and extra (false positives) annotations.
*   **🖼️ Interactive Visual Feedback**: A core feature is the side-by-side visual comparison tool.
    *   View ground truth and student annotations overlaid on the original image.
    *   Click on any annotation in the results table to instantly highlight it in the viewer.
    *   Toggle visibility for different annotation types (Matched, Missed, Extra) to reduce clutter and focus on specific errors.
    *   Zoom and pan capabilities allow for close inspection of annotation boundaries.
*   **⚡️ Instant Rule-Based Feedback**: Get immediate, deterministic feedback on annotation geometry.
    *   When a bounding box is selected, a high-speed, non-AI engine instantly calculates geometric discrepancies.
    *   Identifies and visualizes `gaps` (where the student box is too small) and `cut-offs` (where the student box is too large) on each of the four edges.
    *   Provides clear, templated messages for each geometric error.
*   **🤖 AI-Enhanced Schema Extraction**: The tool uses Google's Gemini models to intelligently understand your data.
    *   On uploading a ground truth file, the tool sends its content to a Genkit flow.
    *   The AI analyzes the file's structure and returns a structured **Evaluation Schema**, including all labels, their associated attributes, and a potential matching key.
    *   It also generates human-readable pseudocode that represents the derived evaluation logic.
*   **✍️ Customizable Evaluation Logic**: Take control of the evaluation process.
    *   Directly edit the AI-generated pseudocode to fine-tune the evaluation logic (e.g., change weights, add custom checks).
    *   Provide plain English instructions (e.g., "ignore the 'color' attribute") and the AI will regenerate both the structured schema and the pseudocode to match your request.

## 🏛️ Architecture Overview

Annotator AI is currently architected as a **standalone in-browser application**. This serverless design was chosen to maximize user privacy (no data ever leaves your machine) and eliminate hosting costs. All processing happens directly on the client-side. While this approach is ideal for smaller datasets and getting started quickly, please see our architectural roadmap for plans to support larger-scale evaluations via a backend server.

The application leverages **Genkit** and Google's **Gemini** models for its AI-powered features, specifically for schema extraction and logic generation. The UI is built with **ShadCN** components for a polished and accessible user experience.

### Core Workflow:

1.  **File Upload & Parsing**: The user begins by uploading a ground truth (GT) annotation file. This can be a COCO JSON, a CVAT XML, or a ZIP archive containing annotations and images. The application uses client-side JavaScript libraries (`JSZip`, `DOMParser`) to read and parse these files directly in the browser. All image data is converted to local blob URLs for rendering.
2.  **AI Schema Extraction**: The text content of the GT file is passed to a `Genkit` flow. This flow communicates with the Gemini API, which analyzes the structure and content of the annotations. The model's task is to identify all unique object labels, their associated attributes (e.g., "color," "occlusion"), and a potential unique identifier (`matchKey`) that can be used to pair annotations. It returns this information as a structured JSON object called `EvalSchema`.
3.  **Rule Configuration**: The `EvalSchema` is stored in the React component's state. The UI then displays the extracted labels, attributes, and a human-readable pseudocode representation of the evaluation logic. The user can review this logic and choose to modify it by either providing new plain-text instructions or by editing the pseudocode directly. Submitting these changes triggers the Genkit flow again to regenerate the `EvalSchema`.
4.  **Student Evaluation**: The user uploads one or more student annotation files. The application's core evaluation engine (`evaluator.ts`) then runs. It takes the parsed GT data, the parsed student data, and the configured `EvalSchema` as input. It performs a multi-stage matching process:
    *   First, it attempts to match GT and student annotations using the `matchKey` if provided.
    *   For any remaining unmatched annotations, it falls back to a bipartite matching algorithm based on IoU (Intersection over Union) to find the most optimal pairs.
5.  **Scoring and Results Generation**: For each matched pair, the engine calculates IoU, label accuracy, and attribute similarity. It also identifies all missed (unmatched GT) and extra (unmatched student) annotations. These metrics are aggregated to compute a final score for each student file. The entire result is compiled into an `EvaluationResult` object.
6.  **Results Display & Feedback**: The `EvaluationResult` objects are passed to the `ResultsDashboard` component. This component displays a summary table and a detailed, expandable breakdown for each student. When an annotation is selected for inspection, the rule-based feedback engine (`annotation-feedback-flow.ts`) instantly calculates geometric discrepancies (`gaps`/`cut-offs`) and provides immediate visual and textual feedback.

## 📊 Data Flow Diagram

This diagram illustrates the complete data flow within the browser.

```mermaid
graph TD
    subgraph "1. Setup & Configuration"
        A[User uploads Ground Truth file] --> B{Parse File & Extract Content};
        B --> C[Genkit Flow: extractEvalSchema];
        C -- GT Content --> D[Gemini API];
        D -- Eval Schema (JSON) --> E[Store EvalSchema in State];
        E --> F[Display Rules & Pseudocode in UI];
        G[User edits rules via UI] --> H{Update EvalSchema State};
        H --> E;
    end

    subgraph "2. Evaluation"
        I[User uploads Student files & Images] --> J{Parse Student Files};
        E --> K[Run Evaluation Engine];
        J --> K;
        K -- GT & Student Data + Schema --> L[Calculate Scores, IoU, Matches, etc.];
        L --> M[Store EvaluationResult in State];
    end

    subgraph "3. Results & Feedback"
        M --> N[Display Results Dashboard];
        O[User selects an annotation] --> P{Get Annotation Data};
        P --> Q[Rule-Based Feedback Engine];
        Q -- Instant Feedback --> R[Display Feedback & Visual Overlay];
    end

    style D fill:#4285F4,stroke:#fff,color:#fff
    style C fill:#fbbc05,stroke:#fff,color:#333
```

## ⚙️ Installation

To run this project locally, you will need Node.js and npm installed.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/annotator-ai.git
    cd annotator-ai
    ```

2.  **Install dependencies:**
    This project uses `npm` for package management. Run the following command to install all necessary dependencies listed in `package.json`.
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    The application requires an API key for Google AI Studio to power the AI-driven features.
    Create a `.env` file in the root of the project by copying the example:
    ```bash
    cp .env.example .env
    ```
    Open the newly created `.env` file and add your Google AI API key:
    ```
    GEMINI_API_KEY=your_google_ai_api_key_here
    ```
    You can obtain a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

4.  **Run the development server:**
    This command starts the Next.js development server.
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:9002`.

## 🚀 Usage Examples

1.  **Launch the application** by following the installation guide.
2.  **Select an Evaluation Mode**: At the top of the page, choose between `Bounding Box`, `Skeleton`, or `Polygon` based on your annotation type.
3.  **Upload Ground Truth**: In the "Ground Truth Annotations" section, upload your expert-reviewed annotation file. This can be a COCO JSON file, a CVAT XML file, or a ZIP archive containing the annotation file and all corresponding images.
4.  **Configure Rules**: Wait for the AI to analyze your file and generate the evaluation rules. Once loaded, the "Evaluation Rules" card will become active. Here you can:
    *   Review the auto-detected labels, attributes, and matching logic.
    *   Provide plain-text instructions (e.g., "The 'occluded' attribute is not important") and click "Apply Instructions" to have the AI regenerate the rules.
    *   Directly edit the Python-like pseudocode for fine-grained control and click "Apply Pseudocode Changes".
5.  **Upload Student Files**: In the "Student Annotations" section, upload one or more student submission files. You can multi-select files or provide a single ZIP archive containing multiple student files.
6.  **Upload Images (if needed)**: If your images were not included in the Ground Truth ZIP, upload them in the "Original Images" section.
7.  **Run Evaluation**: Click the "Run Evaluation" button to start the process.
8.  **Review Results**: The dashboard will populate with a batch summary table and detailed, expandable accordions for each student file.
    *   Click on any student's accordion to see their overall score, feedback, and a per-image breakdown.
    *   Within an image breakdown, click on any row in the "Matched", "Missed," or "Extra" tables to highlight that specific annotation in the interactive viewer.
    *   The viewer provides instant rule-based feedback (gaps/cut-offs) and visual overlays.

## 🔧 Configuration

The primary configuration is done via an environment variable stored in a `.env` file in the project root.

| Variable        | Description                                                                                             | Default | Required |
| --------------- | ------------------------------------------------------------------------------------------------------- | ------- | -------- |
| `GEMINI_API_KEY`| Your API key for Google AI Studio. This is required to power the schema extraction and AI feedback features. | `null`  | **Yes**  |

## 🗺️ Roadmap

We have an exciting roadmap of features planned to make Annotator AI even more powerful.

*   [ ] **Advanced Skeleton Evaluation**: Add support for custom keypoint sigmas and connection templates for different skeleton types (e.g., human, animal).
*   [ ] **Project History**: Implement functionality to save and load previous evaluation sessions from the browser's local storage.
*   [ ] **Configuration Export/Import**: Allow users to save their customized evaluation rule schemas as a JSON file and import them for future sessions.
*   [ ] **Enhanced Visualization**: Implement more detailed feedback visualization options, such as heatmaps for polygon deviation or vector fields for keypoint drift.
*   [ ] **CI/CD**: Add GitHub Actions for automated testing (unit and integration tests) and linting to ensure code quality and stability.
*   [ ] **Web Worker Integration**: Move heavy-duty file parsing and evaluation logic into a Web Worker to ensure the UI remains 100% responsive even with very large datasets.

For a detailed breakdown of our strategic improvement plan, including technical feasibility and long-term vision, please see our complete [Feature Roadmap document](./features.md).

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  **Fork the repository.**
2.  **Create a new branch** for your feature or bug fix:
    ```bash
    git checkout -b feature/your-feature-name
    ```
3.  **Make your changes.** Please ensure your code adheres to the existing style and that you have tested your changes thoroughly.
4.  **Commit your changes** with a clear and descriptive commit message following the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.
5.  **Push to your branch:**
    ```bash
    git push origin feature/your-feature-name
    ```
6.  **Open a Pull Request** against the `main` branch of the original repository. Please ensure your PR includes a clear description of the problem and solution, and reference any relevant issues.

## 📄 License

This project is licensed under the **Apache-2.0 License**. See the `LICENSE` file for details.

## 📞 Contact & Support

*   **Issues**: If you encounter a bug or have a feature request, please [open an issue](https://github.com/your-username/your-repo/issues) on GitHub.
*   **Questions**: For general questions or discussions, please use the [GitHub Discussions](https://github.com/your-username/your-repo/discussions) tab.
