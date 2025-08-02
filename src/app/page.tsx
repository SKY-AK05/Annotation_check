
'use client';

import { useState } from 'react';
import JSZip from 'jszip';
import type { FormValues } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { EvaluationForm } from '@/components/EvaluationForm';
import { ResultsDashboard } from '@/components/ResultsDashboard';
import { RuleConfiguration } from '@/components/RuleConfiguration';
import { AnnotatorAiLogo } from '@/components/AnnotatorAiLogo';
import type { EvaluationResult } from '@/lib/types';
import { evaluateAnnotations } from '@/lib/evaluator';
import { parseCvatXml } from '@/lib/cvat-xml-parser';
import { extractEvalSchema, type EvalSchema } from '@/ai/flows/extract-eval-schema';

export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingRules, setIsGeneratingRules] = useState<boolean>(false);
  const [results, setResults] = useState<EvaluationResult[] | null>(null);
  const [evalSchema, setEvalSchema] = useState<EvalSchema | null>(null);
  const { toast } = useToast();

  const handleGtFileChange = async (file: File | undefined) => {
    if (!file) {
      setEvalSchema(null);
      return;
    }
    
    setIsGeneratingRules(true);
    setResults(null);
    setEvalSchema(null);
    try {
      const fileContent = await file.text();
      const schema = await extractEvalSchema({ gtFileContent: fileContent });
      setEvalSchema(schema);
      toast({
        title: "Evaluation Rules Generated",
        description: "The evaluation schema has been extracted from your GT file.",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Error Generating Rules",
        description: `Could not process the GT file: ${(e as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRules(false);
    }
  }

  const handleEvaluate = async (data: FormValues) => {
    if (!evalSchema) {
      toast({
        title: "Evaluation Rules Missing",
        description: "Please upload a Ground Truth file first to generate rules.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    setResults(null);
  
    try {
        const gtFile = data.gtFile[0];
        if (!gtFile) {
            throw new Error("Ground Truth file is missing.");
        }
        const gtFileContent = await gtFile.text();
        const studentFileInputs = Array.from(data.studentFiles);
        const batchResults: EvaluationResult[] = [];
        
        let studentFiles: { name: string, content: string }[] = [];

        // Handle ZIP file upload
        if (studentFileInputs.length === 1 && studentFileInputs[0].name.endsWith('.zip')) {
            toast({ title: "Processing ZIP file...", description: "Extracting student submissions." });
            const zipFile = studentFileInputs[0];
            const zip = await JSZip.loadAsync(zipFile);
            const filePromises = [];

            for (const filename in zip.files) {
                const fileInZip = zip.files[filename];
                if (fileInZip.dir) continue;
                
                // Handle nested zips for CVAT batch exports
                if (filename.endsWith('.zip')) {
                    const nestedZip = await JSZip.loadAsync(await fileInZip.async('blob'));
                    for (const nestedFilename in nestedZip.files) {
                        const nestedFile = nestedZip.files[nestedFilename];
                        if (!nestedFile.dir && (nestedFilename.endsWith('.xml') || nestedFilename.endsWith('.json'))) {
                             const filePromise = nestedFile.async('string').then(content => ({
                                name: filename, // Use the outer zip filename as student identifier
                                content: content
                            }));
                            filePromises.push(filePromise);
                        }
                    }
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
            studentFiles = await Promise.all(filePromises);
        } else {
            studentFiles = await Promise.all(studentFileInputs.map(async file => ({
                name: file.name,
                content: await file.text()
            })));
        }

        if (studentFiles.length === 0) {
            throw new Error("No valid annotation files (.xml or .json) found in the upload. Please check file formats and try again.");
        }

        let gtAnnotations;
        const isXmlFile = (content: string) => content.trim().startsWith('<?xml');

        if (data.toolType === 'cvat_xml' || isXmlFile(gtFileContent)) {
            gtAnnotations = parseCvatXml(gtFileContent);
        } else {
            gtAnnotations = JSON.parse(gtFileContent);
        }

        for (const studentFile of studentFiles) {
            const studentFileContent = studentFile.content;
            let studentAnnotations;

            if (data.toolType === 'cvat_xml' || isXmlFile(studentFileContent)) {
                studentAnnotations = parseCvatXml(studentFileContent);
            } else {
                studentAnnotations = JSON.parse(studentFileContent);
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
      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 flex flex-col gap-8 lg:sticky lg:top-12">
          <EvaluationForm onEvaluate={handleEvaluate} isLoading={isLoading || isGeneratingRules} onGtFileChange={handleGtFileChange} />
          <RuleConfiguration schema={evalSchema} loading={isGeneratingRules} onSchemaChange={handleSchemaChange} />
        </div>
        <div className="lg:col-span-2">
          <ResultsDashboard results={results} loading={isLoading} />
        </div>
      </main>
    </div>
  );
}
