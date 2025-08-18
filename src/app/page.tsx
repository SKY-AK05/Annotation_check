

'use client';

import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { useToast } from "@/hooks/use-toast";
import { ResultsDashboard } from '@/components/ResultsDashboard';
import { AnnotatorAiLogo } from '@/components/AnnotatorAiLogo';
import type { EvaluationResult, FormValues, CocoJson, SelectedAnnotation, Feedback, ScoreOverrides } from '@/lib/types';
import { evaluateAnnotations, recalculateOverallScore } from '@/lib/evaluator';
import { parseCvatXml } from '@/lib/cvat-xml-parser';
import { extractEvalSchema } from '@/ai/flows/extract-eval-schema';
import type { EvalSchema, EvalSchemaInput } from '@/lib/types';
import SkeletonAnnotationPage from '@/components/SkeletonAnnotationPage';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { BoxSelect, Bone, Spline } from 'lucide-react';
import PolygonAnnotationPage from '@/components/PolygonAnnotationPage';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getAnnotationFeedback } from '@/ai/flows/annotation-feedback-flow';

const LOCAL_STORAGE_KEY = 'annotator-ai-score-overrides';

export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingRules, setIsGeneratingRules] = useState<boolean>(false);
  const [results, setResults] = useState<EvaluationResult[] | null>(null);
  const [evalSchema, setEvalSchema] = useState<EvalSchema | null>(null);
  const [gtFileContent, setGtFileContent] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [evaluationMode, setEvaluationMode] = useState<'bounding-box' | 'skeleton' | 'polygon'>('bounding-box');
  const [selectedAnnotation, setSelectedAnnotation] = useState<SelectedAnnotation | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackCache, setFeedbackCache] = useState<Map<string, Feedback>>(new Map());
  const [scoreOverrides, setScoreOverrides] = useState<ScoreOverrides>({});
  const { toast } = useToast();

  useEffect(() => {
    try {
        const savedOverrides = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedOverrides) {
            setScoreOverrides(JSON.parse(savedOverrides));
        }
    } catch (error) {
        console.error("Could not load score overrides from localStorage", error);
    }
  }, []);

  useEffect(() => {
    if (results) {
      handleRecalculate();
    }
  }, [scoreOverrides]);

  const handleRecalculate = () => {
    if (!results) return;
    const newResults = results.map(res => recalculateOverallScore(res, scoreOverrides));
    setResults(newResults);
  };
  
  const handleScoreOverride = (studentFilename: string, imageId: number, annotationId: number, newScore: number | null) => {
    if (!results) return;

    // Find the original score to compare against
    const result = results.find(r => r.studentFilename === studentFilename);
    const imageResult = result?.image_results.find(ir => ir.imageId === imageId);
    const match = imageResult?.matched.find(m => m.gt.id === annotationId);

    if (!match) return;

    const updatedOverrides = JSON.parse(JSON.stringify(scoreOverrides)) as ScoreOverrides;
    
    // Ensure nested objects exist
    if (!updatedOverrides[studentFilename]) {
        updatedOverrides[studentFilename] = {};
    }
    if (!updatedOverrides[studentFilename][imageId]) {
        updatedOverrides[studentFilename][imageId] = {};
    }

    // If new score is null or same as original, remove the override
    if (newScore === null || newScore === Math.round(match.originalScore)) {
        if (updatedOverrides[studentFilename]?.[imageId]?.[annotationId]) {
             delete updatedOverrides[studentFilename][imageId][annotationId];
        }
    } else {
        // Otherwise, set the new override score
        updatedOverrides[studentFilename][imageId][annotationId] = newScore;
    }

    // Clean up empty objects
    if (Object.keys(updatedOverrides[studentFilename][imageId]).length === 0) {
        delete updatedOverrides[studentFilename][imageId];
    }
    if (Object.keys(updatedOverrides[studentFilename]).length === 0) {
        delete updatedOverrides[studentFilename];
    }
    
    setScoreOverrides(updatedOverrides);
    
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedOverrides));
    } catch (error) {
        console.error("Could not save score overrides to localStorage", error);
    }
  };


  const handleGtFileChange = async (file: File | undefined) => {
    if (!file) {
      setEvalSchema(null);
      setGtFileContent(null);
      setImageUrls(new Map());
      return;
    }
    
    setIsGeneratingRules(true);
    setResults(null);
    setEvalSchema(null);
    setGtFileContent(null);
    setImageUrls(new Map());
    setSelectedAnnotation(null);
    setFeedback(null);
    setFeedbackCache(new Map());

    try {
      let fileContent: string;
      const newImageUrls = new Map<string, string>();

      if (file.name.endsWith('.zip')) {
        toast({ title: "Processing GT ZIP file...", description: "Extracting annotations and images." });
        const zip = await JSZip.loadAsync(file);
        let foundFile: JSZip.JSZipObject | null = null;
        
        const filePromises = Object.values(zip.files).map(async (fileInZip) => {
            if (fileInZip.dir) return;
            
            const isAnnotationFile = fileInZip.name.endsWith('.xml') || fileInZip.name.endsWith('.json');

            if (!foundFile && isAnnotationFile) {
                foundFile = fileInZip;
            } else if (fileInZip.name.match(/\.(jpe?g|png|gif|webp)$/i)) {
                const blob = await fileInZip.async('blob');
                const url = URL.createObjectURL(blob);
                const filename = fileInZip.name.split('/').pop()!;
                newImageUrls.set(filename, url);
            }
        });

        await Promise.all(filePromises);

        if (!foundFile) {
            throw new Error("No .xml or .json annotation file found inside the Ground Truth ZIP archive.");
        }
        fileContent = await foundFile.async('string');

      } else {
        fileContent = await file.text();
      }

      setGtFileContent(fileContent);
      setImageUrls(newImageUrls); // Set images extracted from GT zip
      const schema = await extractEvalSchema({ gtFileContent: fileContent });
      setEvalSchema(schema);
      toast({
        title: "Evaluation Rules Generated",
        description: "The evaluation schema has been extracted from your GT file.",
      });
    } catch (e: any) {
      console.error(e);
      let description = `Could not process the GT file: ${e.message}`;
      // Check if the error is a service availability issue from the AI model
      if (e.cause?.status === 503 || (e.message && e.message.includes('503'))) {
        description = "The AI service is temporarily unavailable. Please try again in a few moments.";
      }
      toast({
        title: "Error Generating Rules",
        description: description,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRules(false);
    }
  }
  
  const prefetchAndCacheFeedback = async (resultsToCache: EvaluationResult[]) => {
      const newCache = new Map<string, Feedback>();
      const feedbackPromises: Promise<void>[] = [];

      for (const result of resultsToCache) {
          for (const imageResult of result.image_results) {
              for (const match of imageResult.matched) {
                  const cacheKey = `${imageResult.imageId}-${match.gt.id}`;
                  if (!newCache.has(cacheKey)) {
                      const promise = getAnnotationFeedback({ gt: match.gt, student: match.student })
                          .then(feedbackResponse => {
                              newCache.set(cacheKey, feedbackResponse);
                          })
                          .catch(error => {
                              console.error(`Failed to prefetch feedback for ${cacheKey}:`, error);
                          });
                      feedbackPromises.push(promise);
                  }
              }
          }
      }

      await Promise.all(feedbackPromises);
      setFeedbackCache(newCache);
      console.log("Feedback cache populated:", newCache);
  };


  const handleEvaluate = async (data: FormValues) => {
    if (!evalSchema || !gtFileContent) {
      toast({
        title: "Evaluation Rules or GT File Missing",
        description: "Please upload a Ground Truth file first to generate rules and prepare for evaluation.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    setResults(null);
    setSelectedAnnotation(null);
    setFeedback(null);
    setFeedbackCache(new Map());
  
    try {
        const studentFileInputs = Array.from(data.studentFiles);
        const imageFileInputs = data.imageFiles ? Array.from(data.imageFiles) : [];
        const batchResults: EvaluationResult[] = [];
        
        let studentFiles: { name: string, content: string }[] = [];
        // Start with images from GT zip, then add/overwrite with explicitly uploaded images
        const newImageUrls = new Map(imageUrls);

        // Handle image files uploaded in the dedicated field
        if(imageFileInputs.length > 0) {
            const imagePromises = imageFileInputs.map(async file => {
              if (file.name.endsWith('.zip')) {
                const zip = await JSZip.loadAsync(file);
                const imageInZipPromises = Object.values(zip.files).map(async (zipFile) => {
                  if (!zipFile.dir && zipFile.name.match(/\.(jpe?g|png|gif|webp)$/i)) {
                    const blob = await zipFile.async('blob');
                    return { name: zipFile.name.split('/').pop()!, url: URL.createObjectURL(blob) };
                  }
                  return null;
                });
                return Promise.all(imageInZipPromises);
              } else {
                 return { name: file.name, url: URL.createObjectURL(file) };
              }
            });

            const allImagesNested = await Promise.all(imagePromises);
            allImagesNested.flat().filter(Boolean).forEach(img => {
                if (img) newImageUrls.set(img.name, img.url);
            });
        }
        
        if (newImageUrls.size === 0) {
            throw new Error("No image files found. Please upload images either in the GT ZIP or the dedicated image upload field.");
        }
        setImageUrls(newImageUrls);

        // Handle ZIP file upload for student files
        if (studentFileInputs.length === 1 && studentFileInputs[0].name.endsWith('.zip')) {
            toast({ title: "Processing Student ZIP file...", description: "Extracting submissions." });
            const zipFile = studentFileInputs[0];
            const zip = await JSZip.loadAsync(zipFile);
            const filePromises = [];

            for (const filename in zip.files) {
                const fileInZip = zip.files[filename];
                if (fileInZip.dir) continue;
                
                // Handle nested zips for CVAT batch exports
                if (filename.endsWith('.zip')) {
                    const filePromise = async () => {
                        try {
                            const nestedZip = await JSZip.loadAsync(await fileInZip.async('blob'));
                            for (const nestedFilename in nestedZip.files) {
                                const nestedFile = nestedZip.files[nestedFilename];
                                if (!nestedFile.dir && (nestedFilename.endsWith('.xml') || nestedFilename.endsWith('.json'))) {
                                    const content = await nestedFile.async('string');
                                    return {
                                        name: filename, // Use the outer zip filename as student identifier
                                        content: content
                                    };
                                }
                            }
                        } catch(e) {
                            console.error(`Skipping corrupted nested zip: ${filename}`, e);
                            return null;
                        }
                        return null;
                    };
                    filePromises.push(filePromise());
                }
                // Handle regular files at top level
                else if (filename.endsWith('.xml') || filename.endsWith('.json')) {
                    const filePromise = fileInZip.async('string').then(content => ({
                        name: filename,
                        content: content
                    }));
                    filePromises.push(filePromise);
                }
            }
            const resolvedFiles = await Promise.all(filePromises);
            studentFiles = resolvedFiles.filter(f => f !== null) as { name: string, content: string }[];
        } else {
            studentFiles = await Promise.all(studentFileInputs.map(async file => ({
                name: file.name,
                content: await file.text()
            })));
        }

        if (studentFiles.length === 0) {
            throw new Error("No valid annotation files (.xml or .json) found in the upload. Please check file formats and try again.");
        }

        let gtAnnotations: CocoJson;
        const isXmlFile = (content: string) => content.trim().startsWith('<?xml');

        if (data.toolType === 'cvat_xml' || isXmlFile(gtFileContent)) {
            gtAnnotations = parseCvatXml(gtFileContent);
        } else {
            gtAnnotations = JSON.parse(gtFileContent);
            // Also normalize image file names for COCO JSON
            gtAnnotations.images.forEach(image => {
                image.file_name = image.file_name.split('/').pop()!;
            });
        }

        for (const studentFile of studentFiles) {
            const studentFileContent = studentFile.content;
            let studentAnnotations: CocoJson;

            if (data.toolType === 'cvat_xml' || isXmlFile(studentFileContent)) {
                studentAnnotations = parseCvatXml(studentFileContent);
            } else {
                studentAnnotations = JSON.parse(studentFileContent);
                // Also normalize image file names for COCO JSON
                studentAnnotations.images.forEach(image => {
                    image.file_name = image.file_name.split('/').pop()!;
                });
            }
        
            const initialResult = evaluateAnnotations(gtAnnotations, evalSchema, studentAnnotations);
            const finalResult = recalculateOverallScore({
                 ...initialResult,
                studentFilename: studentFile.name,
            }, scoreOverrides);

            batchResults.push(finalResult);
        }
        
        setResults(batchResults);
        
        // After evaluation, prefetch and cache all feedback
        prefetchAndCacheFeedback(batchResults);

        toast({
            title: "Batch Evaluation Complete",
            description: `Successfully evaluated ${batchResults.length} student files. Caching feedback...`,
        });

    } catch (e) {
      console.error(e);
      const error = e as Error;
      toast({
        title: "Evaluation Error",
        description: `${error.message}. Please check file formats and try again.`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRuleChange = async (instructions: { pseudoCode?: string; userInstructions?: string }) => {
    if (!gtFileContent) {
        toast({
            title: "Ground Truth File Missing",
            description: "Cannot regenerate rules without the original GT file.",
            variant: "destructive",
        });
        return;
    }
    setIsGeneratingRules(true);
    try {
        const input: EvalSchemaInput = { gtFileContent };
        // User instructions take precedence over pseudocode editing
        if (instructions.userInstructions) {
            input.userInstructions = instructions.userInstructions;
        } else if (instructions.pseudoCode) {
            input.pseudoCode = instructions.pseudoCode;
        }
        
        const newSchema = await extractEvalSchema(input);
        setEvalSchema(newSchema);
        toast({
            title: "Rules Regenerated",
            description: "The evaluation schema has been updated based on your input.",
        });
    } catch (e: any) {
        console.error(e);
        toast({
            title: "Error Regenerating Rules",
            description: `Failed to update rules: ${e.message}`,
            variant: "destructive",
        });
    } finally {
        setIsGeneratingRules(false);
    }
};

  const handleAnnotationSelect = async (annotation: SelectedAnnotation | null) => {
    setSelectedAnnotation(annotation);
    
    if (!annotation) {
      setFeedback(null);
      return;
    }
    
    const cacheKey = `${annotation.imageId}-${annotation.annotationId}`;

    if (feedbackCache.has(cacheKey)) {
        setFeedback(feedbackCache.get(cacheKey)!);
        return;
    }
    
    // Fallback if not in cache (should be rare)
    if (!results || annotation.type !== 'match') {
      setFeedback(null);
      return;
    }

    const result = results.find(r => r.image_results.some(ir => ir.imageId === annotation.imageId));
    const imageResult = result?.image_results.find(ir => ir.imageId === annotation.imageId);
    const match = imageResult?.matched.find(m => m.gt.id === annotation.annotationId);

    if (match) {
        try {
            const feedbackResponse = await getAnnotationFeedback({ gt: match.gt, student: match.student });
            setFeedback(feedbackResponse);
            // Also update the cache
            setFeedbackCache(prev => new Map(prev).set(cacheKey, feedbackResponse));
        } catch (error) {
             console.error("Failed to get feedback:", error);
             toast({ title: "Error", description: "Could not generate feedback for this annotation.", variant: "destructive" });
        }
    } else {
      setFeedback(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 md:p-12">
      <header className="w-full max-w-7xl flex items-center justify-between mb-8">
        <div className="flex items-center">
            <AnnotatorAiLogo className="h-10 w-10 text-primary" />
            <h1 className="text-4xl ml-4">Annotator AI</h1>
        </div>
        <ThemeToggle />
      </header>
      <main className="w-full max-w-7xl flex-grow">
        <RadioGroup
              defaultValue="bounding-box"
              className="grid grid-cols-3 gap-4 mb-6 max-w-lg mx-auto"
              onValueChange={(mode: 'bounding-box' | 'skeleton' | 'polygon') => setEvaluationMode(mode)}
              value={evaluationMode}
          >
              <div>
                <RadioGroupItem value="bounding-box" id="bounding-box" className="peer sr-only" />
                <Label
                  htmlFor="bounding-box"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-foreground bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary w-full shadow-hard card-style"
                >
                  <BoxSelect className="mb-3 h-6 w-6" />
                  <span className="font-bold text-center">Bounding Box</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="skeleton" id="skeleton" className="peer sr-only" />
                <Label
                  htmlFor="skeleton"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-foreground bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary w-full shadow-hard card-style"
                >
                  <Bone className="mb-3 h-6 w-6" />
                  <span className="font-bold text-center">Skeleton</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="polygon" id="polygon" className="peer sr-only" />
                <Label
                  htmlFor="polygon"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-foreground bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary w-full shadow-hard card-style"
                >
                  <Spline className="mb-3 h-6 w-6" />
                  <span className="font-bold text-center">Polygon</span>
                </Label>
              </div>
          </RadioGroup>

          {evaluationMode === 'bounding-box' ? (
              <ResultsDashboard
                  results={results}
                  loading={isLoading || isGeneratingRules}
                  imageUrls={imageUrls}
                  onEvaluate={handleEvaluate}
                  onGtFileChange={handleGtFileChange}
                  evalSchema={evalSchema}
                  onRuleChange={handleRuleChange}
                  selectedAnnotation={selectedAnnotation}
                  onAnnotationSelect={handleAnnotationSelect}
                  feedback={feedback}
                  onScoreOverride={handleScoreOverride}
              />
          ) : evaluationMode === 'skeleton' ? (
              <SkeletonAnnotationPage />
          ) : (
              <PolygonAnnotationPage />
          )}
      </main>
      <footer className="w-full max-w-7xl mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Annotator AI. All Rights Reserved.
      </footer>
    </div>
  );
}
