# **App Name**: Annotator AI

## Core Features:

- Data Upload: Upload Ground Truth and Student Annotations in COCO JSON, Pascal VOC XML, or CVAT format.
- Tool Type Selection: Select annotation tool type (bounding box, polygon, keypoints).
- Rule Configuration: Define or edit evaluation rules via a simple UI form.
- Evaluation Execution: Execute safe Python evaluation script to compare GT and student annotations.
- AI Scoring Fallback: AI-assisted scoring fallback tool: If the primary scoring rules fail due to format issues or code errors, use an AI model (accessed via OpenRouter) to approximate the correctness. The tool is only used if the main logic errors, using traceback information passed to the LLM.
- Results Dashboard: Display score, feedback, and detailed breakdown per image in an intuitive results dashboard.
- Downloadable Feedback: Allow downloading the feedback in CSV or Excel format for external analysis.

## Style Guidelines:

- Primary color: Moderate blue (#5DADE2) to suggest accuracy and reliability.
- Background color: Very light blue (#F0F8FF) to keep things simple and neutral.
- Accent color: Light orange (#FFB347) to draw attention to key feedback and call-to-action buttons.
- Font: 'Inter' (sans-serif) for a modern, clean, and readable interface. Use Inter for headlines and body text.
- Use simple, clear icons to represent different annotation tools, score metrics, and feedback types.
- Employ a grid-based layout for easy navigation and a well-organized results presentation.
- Use subtle animations to highlight important changes or updates to the UI.