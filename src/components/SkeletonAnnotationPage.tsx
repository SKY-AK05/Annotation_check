
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function SkeletonAnnotationPage() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Skeleton Annotation Evaluation</CardTitle>
        <CardDescription>
          This feature is under construction. Soon, you will be able to evaluate skeleton annotations (COCO Keypoints format) here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center text-center p-16 border-dashed border-2 rounded-lg m-6">
        <Construction className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground">Coming Soon!</h3>
        <p className="text-muted-foreground mt-2">
          The development for skeleton annotation evaluation is in progress.
        </p>
      </CardContent>
    </Card>
  );
}
