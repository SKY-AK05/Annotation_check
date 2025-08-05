
'use client';

import { useState } from 'react';
import JSZip from 'jszip';
import type { FormValues, CocoJson } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { EvaluationForm } from '@/components/EvaluationForm';
import { ResultsDashboard } from '@/components/ResultsDashboard';
import { RuleConfiguration } from '@/components/RuleConfiguration';
import { AnnotatorAiLogo } from '@/components/AnnotatorAiLogo';
import type { EvaluationResult } from '@/lib/types';
import { evaluateAnnotations } from '@/lib/evaluator';
import { parseCvatXml } from '@/lib/cvat-xml-parser';
import { extractEvalSchema, type EvalSchema } from '@/ai/flows/extract-eval-schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonAnnotationPage } from '@/components/SkeletonAnnotationPage';

export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingRules, setIsGeneratingRules] = useState<boolean>(false);
  const [results, setResults] = useState<EvaluationResult[] | null>(null);
  const [evalSchema, setEvalSchema] = useState<EvalSchema | null>(null);
  const [gtFileContent, setGtFileContent] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();

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
        
            const manualResult = evaluateAnnotations(gtAnnotations, studentAnnotations, evalSchema);
            batchResults.push({
                ...manualResult,
                studentFilename: studentFile.name,
            });
        }
        
        setResults(batchResults);

        toast({
            title: "Batch Evaluation Complete",
            description: `Successfully evaluated ${batchResults.length} student files.`,
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

  const handleSchemaChange = (newSchema: EvalSchema) => {
    setEvalSchema(newSchema);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 md:p-12 bg-light-blue">
      <header className="w-full max-w-7xl flex items-center justify-start mb-8">
        <AnnotatorAiLogo className="h-10 w-10 text-primary" />
        <h1 className="text-3xl font-bold ml-4 tracking-tight">Annotator AI</h1>
      </header>
      <main className="w-full max-w-7xl">
        <Tabs defaultValue="bounding-box" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="bounding-box">Bounding Box Evaluation</TabsTrigger>
            <TabsTrigger value="skeleton">Skeleton Evaluation</TabsTrigger>
          </TabsList>
          <TabsContent value="bounding-box">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-1 flex flex-col gap-8 lg:sticky lg:top-12">
                <EvaluationForm onEvaluate={handleEvaluate} isLoading={isLoading || isGeneratingRules} onGtFileChange={handleGtFileChange} />
                <RuleConfiguration schema={evalSchema} loading={isGeneratingRules} onSchemaChange={handleSchemaChange} />
              </div>
              <div className="lg:col-span-2">
                <ResultsDashboard results={results} loading={isLoading} imageUrls={imageUrls} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="skeleton">
            <SkeletonAnnotationPage />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
