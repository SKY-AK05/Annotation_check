
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Code2, FileJson } from "lucide-react";
import type { EvalSchema } from "@/ai/flows/extract-eval-schema";

interface RuleConfigurationProps {
  schema: EvalSchema | null;
  loading: boolean;
}

const Placeholder = () => (
    <Card className="flex flex-col items-center justify-center text-center p-8 h-full min-h-[200px] border-dashed">
      <FileJson className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground">Awaiting Ground Truth</h3>
      <p className="text-muted-foreground mt-1 text-sm">Upload a GT file to generate evaluation rules.</p>
    </Card>
);

const SkeletonCard = () => (
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/6" />
      </CardContent>
    </Card>
  );

export function RuleConfiguration({ schema, loading }: RuleConfigurationProps) {
  if (loading) return <SkeletonCard />;
  if (!schema) return <Placeholder />;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Code2 className="w-6 h-6" />
            Evaluation Rules
        </CardTitle>
        <CardDescription>
          This pseudocode is auto-generated from your Ground Truth file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="bg-muted p-4 rounded-lg text-xs text-muted-foreground overflow-x-auto">
          <code>{schema.pseudoCode}</code>
        </pre>
      </CardContent>
    </Card>
  );
}
