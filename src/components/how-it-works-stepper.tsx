"use client";

import type React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { StepGoogleLogin } from "@/components/previews/step-google-login";
import { StepConfigure } from "@/components/previews/step-configure";
import { StepDeploy } from "@/components/previews/step-deploy";
import { StepMarketplace } from "@/components/previews/step-marketplace";

export interface StepData {
  id: string;
  number: string;
  title: string;
  description: string;
}

const previewComponents: Record<string, React.ReactNode> = {
  "step-1": <StepGoogleLogin />,
  "step-2": <StepConfigure />,
  "step-3": <StepDeploy />,
  "step-4": <StepMarketplace />,
};

export function HowItWorksStepper({ steps }: { steps: StepData[] }) {
  return (
    <Tabs
      defaultValue="step-1"
      orientation="vertical"
      className="flex flex-col gap-0 md:flex-row md:gap-8"
    >
      {/* Step list — left column */}
      <TabsList
        variant="line"
        className="flex h-fit w-full flex-col items-stretch justify-start gap-0 rounded-none bg-transparent p-0 md:w-72 md:min-w-72 md:max-w-72"
      >
        {steps.map((step, i) => (
          <TabsTrigger
            key={step.id}
            value={step.id}
            className={cn(
              "group/trigger flex h-auto w-full flex-row items-start gap-4 overflow-hidden whitespace-normal rounded-none border-0 px-0 py-5 text-left",
              "data-active:bg-transparent",
              "after:hidden",
              i < steps.length - 1 ? "border-b border-border" : ""
            )}
          >
            {/* Step number */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-bold text-muted-foreground transition-colors group-data-[state=active]/trigger:border-primary group-data-[state=active]/trigger:bg-primary group-data-[state=active]/trigger:text-primary-foreground">
              {step.number}
            </div>

            {/* Title + description */}
            <div className="flex min-w-0 flex-col gap-0.5 text-left overflow-hidden">
              <span className="text-sm font-semibold text-foreground/70 transition-colors group-data-[state=active]/trigger:text-foreground">
                {step.title}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {step.description}
              </span>
            </div>
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Preview panel — right column */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-muted/30 min-h-72 md:min-h-96">
        {steps.map((step) => (
          <TabsContent
            key={step.id}
            value={step.id}
            className="absolute inset-0 mt-0 flex items-center justify-center data-[state=inactive]:hidden"
          >
            {previewComponents[step.id]}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
