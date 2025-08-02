
'use client';

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, UploadCloud, FileCog, Sparkles } from 'lucide-react';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { FormValues } from '@/lib/types';

const formSchema = z.object({
  gtFile: typeof window === 'undefined' ? z.any() : z.instanceof(FileList).refine((files) => files?.length === 1, "Ground Truth file is required."),
  studentFile: typeof window === 'undefined' ? z.any() : z.instanceof(FileList).refine((files) => files?.length === 1, "Student Annotation file is required."),
  toolType: z.string({ required_error: 'Please select a tool type.' }),
  useAi: z.boolean().default(false),
});

interface EvaluationFormProps {
  onEvaluate: (data: FormValues) => void;
  isLoading: boolean;
  onGtFileChange: (file: File | undefined) => void;
}

export function EvaluationForm({ onEvaluate, isLoading, onGtFileChange }: EvaluationFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      toolType: "bounding_box",
      useAi: false,
    },
  });

  const gtFileRef = form.register("gtFile");
  const studentFileRef = form.register("studentFile");

  function onSubmit(values: z.infer<typeof formSchema>) {
    onEvaluate({
      gtFile: values.gtFile[0],
      studentFile: values.studentFile[0],
      toolType: values.toolType,
      useAi: values.useAi,
    });
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <FileCog className="w-6 h-6" />
            New Evaluation
        </CardTitle>
        <CardDescription>Upload annotations to compare and score. The GT file defines the rules.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="gtFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>1. Ground Truth Annotations</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <UploadCloud className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input 
                        type="file" 
                        className="pl-10" 
                        {...gtFileRef} 
                        onChange={(e) => {
                            field.onChange(e.target.files);
                            onGtFileChange(e.target.files?.[0]);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>This file will be used to auto-generate evaluation rules.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="studentFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>2. Student Annotations</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <UploadCloud className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input type="file" className="pl-10" {...studentFileRef} />
                    </div>
                  </FormControl>
                  <FormDescription>Upload the student's submission file to be evaluated.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="toolType"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Tool Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a tool type" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bounding_box">COCO JSON (Bounding Box)</SelectItem>
                          <SelectItem value="cvat_xml">CVAT XML 1.1</SelectItem>
                          <SelectItem value="polygon">Polygon (Requires AI)</SelectItem>
                          <SelectItem value="keypoints">Keypoints (Requires AI)</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                    control={form.control}
                    name="useAi"
                    render={({ field }) => (
                        <FormItem className="flex flex-col justify-center pt-2">
                            <Label htmlFor="ai-switch" className="mb-2.5">AI Assistance</Label>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="ai-switch"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                                <Label htmlFor="ai-switch" className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Sparkles className="w-4 h-4 text-accent" />
                                    Force AI Fallback
                                </Label>
                            </div>
                        </FormItem>
                    )}
                />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Evaluating...
                </>
              ) : (
                'Run Evaluation'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
