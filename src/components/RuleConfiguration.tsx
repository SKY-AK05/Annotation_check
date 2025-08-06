
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Code2, FileJson, Sparkles, Wand2 } from "lucide-react";
import type { EvalSchema } from "@/ai/flows/extract-eval-schema";
import { Badge } from "./ui/badge";
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Button } from './ui/button';

interface RuleConfigurationProps {
  schema: EvalSchema | null;
  loading: boolean;
  onRuleChange: (instructions: { pseudoCode?: string; userInstructions?: string }) => void;
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
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-24" />
      </CardContent>
    </Card>
  );

export function RuleConfiguration({ schema, loading, onRuleChange }: RuleConfigurationProps) {
  const [pseudoCode, setPseudoCode] = React.useState(schema?.pseudoCode || '');
  const [userInstructions, setUserInstructions] = React.useState('');
  const [editedPseudoCode, setEditedPseudoCode] = React.useState(schema?.pseudoCode || '');

  React.useEffect(() => {
    if (schema) {
      setPseudoCode(schema.pseudoCode);
      setEditedPseudoCode(schema.pseudoCode);
    }
  }, [schema]);
  
  const handleRegenerateFromInstructions = () => {
    onRuleChange({
        userInstructions: userInstructions,
    });
    setUserInstructions(''); // Clear instructions after submission
  };

  const handleRegenerateFromPseudoCode = () => {
    onRuleChange({
        pseudoCode: editedPseudoCode,
    });
  };

  const hasInstructions = userInstructions.trim().length > 0;
  const hasPseudoCodeChanged = pseudoCode.trim() !== editedPseudoCode.trim();

  if (loading && !schema) return <SkeletonCard />;

  return (
    <div>
        <div className='flex items-center gap-3 mb-4'>
            <Code2 className="w-6 h-6" />
            <div className="flex-1">
                <h2 className="text-2xl font-bold tracking-tight">
                    Evaluation Rules
                </h2>
                <p className="text-sm text-muted-foreground">
                    This logic is auto-generated. Customize it with instructions or by editing the pseudocode directly.
                </p>
            </div>
        </div>

      {!schema ? <Placeholder /> : (
        <Card>
            <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm">Labels & Attributes</h4>
                            <div className="flex flex-wrap gap-2">
                            {schema.labels.map(label => (
                                <Badge key={label.name} variant="secondary" className="text-xs">
                                    {label.name}
                                    {label.attributes.length > 0 && ` (${label.attributes.join(', ')})`}
                                </Badge>
                            ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm">Matching Key</h4>
                            <Badge variant="outline" className="text-xs">{schema.matchKey || 'IoU + Label'}</Badge>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="plain-english-instructions" className="text-sm font-semibold flex items-center gap-2">
                                <Wand2 className="w-4 h-4" />
                                Plain English Instructions
                            </Label>
                            <Textarea 
                                id="plain-english-instructions"
                                className="bg-background p-2 rounded-lg text-sm text-foreground font-sans h-24"
                                placeholder="e.g., 'Ignore the color attribute for cars.' or 'Only check pedestrians for IoU.'"
                                value={userInstructions}
                                onChange={(e) => setUserInstructions(e.target.value)}
                                disabled={loading}
                            />
                             <Button onClick={handleRegenerateFromInstructions} disabled={loading || !hasInstructions} size="sm">
                                {loading && hasInstructions ? 'Applying...' : 'Apply Instructions'}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pseudocode" className="text-sm font-semibold">Logic Pseudocode (Editable)</Label>
                        <Textarea 
                            id="pseudocode"
                            className="bg-muted p-4 rounded-lg text-xs text-muted-foreground overflow-x-auto font-mono h-64"
                            value={editedPseudoCode}
                            onChange={(e) => setEditedPseudoCode(e.target.value)}
                            disabled={loading}
                        />
                        <Button onClick={handleRegenerateFromPseudoCode} disabled={loading || !hasPseudoCodeChanged} size="sm">
                             {loading && hasPseudoCodeChanged ? 'Applying...' : 'Apply Pseudocode Changes'}
                        </Button>
                    </div>
                </div>
                <div className="w-full flex justify-center">
                    <Button onClick={() => hasInstructions ? handleRegenerateFromInstructions() : handleRegenerateFromPseudoCode() } disabled={loading || (!hasInstructions && !hasPseudoCodeChanged)} className="w-full md:w-auto mt-6">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Regenerate Rules
                    </Button>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
