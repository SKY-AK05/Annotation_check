
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Code2, FileJson, Save } from "lucide-react";
import type { EvalSchema } from "@/ai/flows/extract-eval-schema";
import { Badge } from "./ui/badge";
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

interface RuleConfigurationProps {
  schema: EvalSchema | null;
  loading: boolean;
  onSchemaChange: (newSchema: EvalSchema) => void;
}

const Placeholder = () => (
    <Card className="flex flex-col items-center justify-center text-center p-8 h-full min-h-[200px] border-dashed">
      <FileJson className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground">Awaiting Ground Truth</h3>
      <p className="text-muted-foreground mt-1 text-sm">Upload a GT file to auto-generate evaluation rules.</p>
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
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-24" />
      </CardContent>
    </Card>
  );

export function RuleConfiguration({ schema, loading, onSchemaChange }: RuleConfigurationProps) {
  const [editableSchema, setEditableSchema] = React.useState<EvalSchema | null>(schema);
  const { toast } = useToast();

  React.useEffect(() => {
    setEditableSchema(schema);
  }, [schema]);

  const handleSave = () => {
    if (editableSchema) {
      onSchemaChange(editableSchema);
      toast({
        title: "Rules Saved",
        description: "Your updated evaluation logic will be used for the next run.",
      });
    }
  };
  
  if (loading) return <SkeletonCard />;
  if (!editableSchema) return <Placeholder />;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Code2 className="w-6 h-6" />
            Evaluation Rules
        </CardTitle>
        <CardDescription>
          This logic is auto-generated from your GT file. You can edit it and save to customize the evaluation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
            <h4 className="font-semibold text-sm">Labels & Attributes</h4>
            <div className="flex flex-wrap gap-2">
            {editableSchema.labels.map(label => (
                <Badge key={label.name} variant="secondary" className="text-xs">
                    {label.name}
                    {label.attributes.length > 0 && ` (${label.attributes.join(', ')})`}
                </Badge>
            ))}
            </div>
        </div>
         <div className="space-y-2">
            <h4 className="font-semibold text-sm">Matching Key</h4>
             <Badge variant="outline" className="text-xs">{editableSchema.matchKey || 'IoU + Label'}</Badge>
        </div>
        <div className="space-y-2">
             <h4 className="font-semibold text-sm">Logic Pseudocode (Editable)</h4>
            <Textarea 
                className="bg-muted p-4 rounded-lg text-xs text-muted-foreground overflow-x-auto font-mono h-48"
                value={editableSchema.pseudoCode}
                onChange={(e) => setEditableSchema({...editableSchema, pseudoCode: e.target.value})}
            />
        </div>
        <Button onClick={handleSave} size="sm">
            <Save className="mr-2 h-4 w-4" />
            Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
