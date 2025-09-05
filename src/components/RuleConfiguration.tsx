
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Code2, FileJson, Sparkles, Wand2, Info, Percent, Weight, Shapes, Check, Scale } from "lucide-react";
import type { EvalSchema, ScoringWeights } from "@/lib/types";
import { Badge } from "./ui/badge";
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Slider } from './ui/slider';

interface RuleConfigurationProps {
  schema: EvalSchema | null;
  loading: boolean;
  onRuleChange: (instructions: { pseudoCode?: string; userInstructions?: string, weights?: ScoringWeights }) => void;
}

const Placeholder = () => (
    <div className="flex flex-col items-center justify-center text-center p-8 h-full min-h-[200px] border-dashed border-2 rounded-lg bg-card card-style">
      <FileJson className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-bold text-foreground">Awaiting Ground Truth</h3>
      <p className="text-muted-foreground mt-1 text-sm">Upload a GT file to auto-generate evaluation rules.</p>
    </div>
);

const SkeletonCard = () => (
    <div className="space-y-3">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-6">
                 <Skeleton className="h-12 w-full" />
                 <Skeleton className="h-24 w-full" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
        <Skeleton className="h-10 w-40" />
    </div>
  );

const defaultWeights: ScoringWeights = {
    quality: 90,
    completeness: 10,
    iou: 50,
    label: 25,
    attribute: 25
};

export function RuleConfiguration({ schema, loading, onRuleChange }: RuleConfigurationProps) {
  const [userInstructions, setUserInstructions] = React.useState('');
  const [editedPseudoCode, setEditedPseudoCode] = React.useState('');
  const [weights, setWeights] = React.useState<ScoringWeights>(schema?.weights || defaultWeights);
  
  const weightsRef = React.useRef(weights);

  React.useEffect(() => {
    if (schema?.pseudoCode) {
      setEditedPseudoCode(schema.pseudoCode);
    }
    if (schema?.weights) {
        setWeights(schema.weights);
        weightsRef.current = schema.weights;
    } else {
        setWeights(defaultWeights);
        weightsRef.current = defaultWeights;
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

  const handleWeightChange = (key: keyof ScoringWeights, value: number[]) => {
    const newWeights = { ...weightsRef.current, [key]: value[0] };
    weightsRef.current = newWeights;
    setWeights(newWeights);
  };
  
  const handleFinalWeightChange = () => {
    onRuleChange({ weights: weightsRef.current });
  };


  if (loading && !schema) return <SkeletonCard />;
  if (!schema) return <Placeholder />;
  
  const currentWeights = schema.weights || defaultWeights;

  return (
    <Card>
        <CardContent className="space-y-6 pt-6">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="space-y-6">
                 <h4 className="font-bold text-lg flex items-center gap-2">
                    <Percent className="h-5 w-5"/>
                    Scoring Weights
                 </h4>
                 <div className="space-y-4">
                     <div className="space-y-2">
                         <Label htmlFor='quality-weight' className="flex items-center justify-between">
                            <span className='flex items-center gap-2'><Weight className="h-4 w-4"/>Quality</span>
                            <span>{currentWeights.quality}%</span>
                         </Label>
                         <Slider 
                            id="quality-weight" 
                            value={[currentWeights.quality]} 
                            max={100} 
                            step={5} 
                            onValueChange={(v) => handleWeightChange('quality', v)}
                            onValueCommit={handleFinalWeightChange}
                        />
                     </div>
                     <div className="space-y-2">
                         <Label htmlFor='completeness-weight' className="flex items-center justify-between">
                            <span className='flex items-center gap-2'><Check className="h-4 w-4"/>Completeness</span>
                            <span>{currentWeights.completeness}%</span>
                         </Label>
                         <Slider 
                            id="completeness-weight" 
                            value={[currentWeights.completeness]} 
                            max={100} 
                            step={5} 
                            onValueChange={(v) => handleWeightChange('completeness', v)}
                            onValueCommit={handleFinalWeightChange}
                        />
                     </div>
                 </div>

                 <h4 className="font-bold text-lg flex items-center gap-2 mt-4">
                    <Scale className="h-5 w-5"/>
                    Quality Score Breakdown
                 </h4>
                 <div className="space-y-4">
                     <div className="space-y-2">
                         <Label htmlFor='iou-weight' className="flex items-center justify-between">
                            <span className='flex items-center gap-2'><Shapes className="h-4 w-4"/>IoU</span>
                            <span>{currentWeights.iou}%</span>
                         </Label>
                         <Slider 
                            id="iou-weight" 
                            value={[currentWeights.iou]} 
                            max={100} 
                            step={5} 
                            onValueChange={(v) => handleWeightChange('iou', v)}
                            onValueCommit={handleFinalWeightChange}
                        />
                     </div>
                     <div className="space-y-2">
                         <Label htmlFor='label-weight' className="flex items-center justify-between">
                            <span className='flex items-center gap-2'><Badge className="h-4 w-4 p-0"/>Label</span>
                            <span>{currentWeights.label}%</span>
                         </Label>
                         <Slider 
                            id="label-weight" 
                            value={[currentWeights.label]} 
                            max={100} 
                            step={5} 
                            onValueChange={(v) => handleWeightChange('label', v)}
                            onValueCommit={handleFinalWeightChange}
                        />
                     </div>
                     <div className="space-y-2">
                         <Label htmlFor='attribute-weight' className="flex items-center justify-between">
                            <span className='flex items-center gap-2'><Info className="h-4 w-4"/>Attribute</span>
                            <span>{currentWeights.attribute}%</span>
                         </Label>
                         <Slider 
                            id="attribute-weight" 
                            value={[currentWeights.attribute]} 
                            max={100} 
                            step={5} 
                            onValueChange={(v) => handleWeightChange('attribute', v)}
                            onValueCommit={handleFinalWeightChange}
                        />
                     </div>
                 </div>
               </div>

                <div className="space-y-6">
                    <div>
                        <h4 className="font-bold text-lg">Labels & Attributes</h4>
                        <div className="flex flex-wrap gap-2 mt-2">
                        {schema.labels.map(label => (
                            <Badge key={label.name} variant="secondary" className="border-2 border-foreground shadow-hard">
                                {label.name}
                                {label.attributes.length > 0 && ` (${label.attributes.join(', ')})`}
                            </Badge>
                        ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-lg">Matching Key</h4>
                        <Badge variant="outline" className="border-2 border-foreground shadow-hard mt-2">{schema.matchKey || 'IoU + Label'}</Badge>
                    </div>
                    <div>
                        <Label htmlFor="pseudocode" className="text-lg font-bold">Logic Pseudocode</Label>
                        <Textarea 
                            id="pseudocode"
                            className="p-4 rounded-lg text-xs text-muted-foreground overflow-x-auto font-mono h-48 bg-card shadow-hard mt-2"
                            value={editedPseudoCode}
                            onChange={(e) => setEditedPseudoCode(e.target.value)}
                            disabled={loading}
                        />
                        <Button onClick={handleRegenerateFromPseudoCode} disabled={loading || schema.pseudoCode === editedPseudoCode} size="sm" className="mt-2">
                            {loading && schema.pseudoCode !== editedPseudoCode ? 'Applying...' : 'Apply Pseudocode Changes'}
                        </Button>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
  );
}
