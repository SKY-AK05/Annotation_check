
'use client';

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, UploadCloud, FileCog } from 'lucide-react';

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
import type { FormValues } from '@/lib/types';

const formSchema = z.object({
  gtFile: typeof window === 'undefined' ? z.any() : z.instanceof(FileList).refine((files) => files?.length === 1, "Ground Truth file is required."),
  studentFile: typeof window === 'undefined' ? z.any() : z.instanceof(FileList).refine((files) => files?.length === 1, "Student Annotation file is required."),
  toolType: z.string({ required_error: 'Please select a tool type.' }),
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
    },
  });

  const gtFileRef = form.register("gtFile");
  const studentFileRef = form.register("studentFile");

  function onSubmit(values: z.infer<typeof formSchema>) {
    onEvaluate({
      gtFile: values.gtFile[0],
      studentFile: values.studentFile[0],
      toolType: values.toolType,
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
                        <SelectItem value="polygon" disabled>Polygon (Coming Soon)</SelectItem>
                        <SelectItem value="keypoints" disabled>Keypoints (Coming Soon)</SelectItem>
                      </SelectContent>
                  </Select>
                  <FormMessage />
                  </FormItem>
              )}
            />
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
