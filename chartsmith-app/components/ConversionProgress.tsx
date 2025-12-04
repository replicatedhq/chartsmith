"use client";

import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { FileSearch, FileCheck, Loader2, ArrowRight } from 'lucide-react';
import { useRouter } from "next/navigation";
import { useTheme } from "../contexts/ThemeContext";
import { conversionByIdAtom, conversionsAtom, handleConversionUpdatedAtom } from "@/atoms/workspace";
import { FileList } from './FileList';
import type { ConversionStep, FileConversion } from "./conversion-types";
import { getWorkspaceConversionAction } from "@/lib/workspace/actions/get-workspace-conversion";
import { useSession } from "@/app/hooks/useSession";
import { Conversion, ConversionStatus } from "@/lib/types/workspace";

// Placeholder components - to be implemented later
const Header = () => (
  <div className="mb-2">
    <h1 className="text-lg font-semibold">Conversion Progress</h1>
  </div>
);

interface StepItemProps {
  step: ConversionStep;
  conversion: Conversion;
  isCurrent: boolean;
  isPrevious: boolean;
  isFuture: boolean;
}

const StepItem = ({
  step,
  conversion,
  isCurrent,
  isPrevious,
  isFuture
}: StepItemProps) => {
  let showFileList = false;
  if (step.id === 3 && conversion.status === ConversionStatus.Templating) {
    showFileList = true;
  }
  if (step.id === 5 && conversion.status === ConversionStatus.Simplifying) {
    showFileList = true;
  }

  return (
    <div
      className={`px-2 transition-all duration-200 ${
        isCurrent
          ? 'pb-3 border border-blue-500/20 bg-blue-500/[0.03] rounded-lg'
          : ''
      } ${
        isFuture
          ? 'opacity-40'
          : ''
      }`}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2 py-1.5">
          {isCurrent ? (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
          ) : isPrevious ? (
            <FileCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
          ) : (
            <FileSearch className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <div className="-space-y-0.5">
            <h3 className="font-medium text-sm">{step.name}</h3>
            <p className="text-xs text-gray-400">{step.description}</p>
          </div>
        </div>

        {showFileList && (
          <div className="max-h-[300px] overflow-y-auto">
            <FileList
              files={conversion.sourceFiles}
              currentFileIndex={0}
              isTemplateStep={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const ActionButton = ({ onClick, isComplete, isNextFile, disabled }: {
  onClick: () => void;
  isComplete?: boolean;
  isNextFile?: boolean;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 rounded-lg"
  >
    {isComplete ? 'Complete' : isNextFile ? 'Next File' : 'Continue'}
  </button>
);

const ContinueButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full mt-4 px-4 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors flex items-center justify-center gap-2 border border-blue-500/20"
  >
    Continue with converted chart
    <ArrowRight className="w-4 h-4" />
  </button>
);

export function ConversionProgress({ conversionId }: { conversionId: string }) {
  const { session } = useSession();
  const router = useRouter();
  const [conversionGetter] = useAtom(conversionByIdAtom);
  const [conversions] = useAtom(conversionsAtom);
  const [, handleConversionUpdated] = useAtom(handleConversionUpdatedAtom);
  const conversion = conversionGetter(conversionId);
  const [isLoading, setIsLoading] = useState(true);
  const [currentFileIndex] = useState(0);

  const [steps, setSteps] = useState<ConversionStep[]>([
    {
      id: 1,
      name: "Analyzing Manifests",
      description: "Scanning Kubernetes resources and structure",
      status: "pending"
    },
    {
      id: 2,
      name: "Sorting to find dependencies",
      description: "Mapping relationships between resources",
      status: "pending"
    },
    {
      id: 3,
      name: "Creating initial templates",
      description: "Converting manifests to Helm format",
      status: "pending"
    },
    {
      id: 4,
      name: "Normalizing values",
      description: "Identifying and standardizing parameters",
      status: "pending"
    },
    {
      id: 5,
      name: "Simplifying templates",
      description: "Optimizing and deduplicating configurations",
      status: "pending"
    },
    {
      id: 6,
      name: "Final assembly",
      description: "Packaging the complete Helm chart",
      status: "pending"
    }
  ]);

  const fileConversions: FileConversion[] = conversion?.sourceFiles?.map(sourceFile => ({
    id: sourceFile.id,
    sourceFile: sourceFile.filePath,
    templateFile: `templates/${sourceFile.filePath.split('/').pop()}`,
    status: 'pending'
  })) || [];

  useEffect(() => {
    async function loadConversion() {
      if (!session) {
        return;
      }
      if (!conversion) {
        try {
          const result = await getWorkspaceConversionAction(session, conversionId);
          handleConversionUpdated(result);
          setIsLoading(false);
        } catch (error) {
          console.error('Failed to load conversion:', error);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }

    loadConversion();
  }, [session, conversion, conversionId, handleConversionUpdated]);

  // Add effect to update steps based on conversion status
  useEffect(() => {
    if (!conversion) return;

    setSteps(prevSteps => {
      const newSteps = [...prevSteps];

      // Mark all steps up to current as complete
      const statusOrder = [
        ConversionStatus.Analyzing,
        ConversionStatus.Sorting,
        ConversionStatus.Templating,
        ConversionStatus.Normalizing,
        ConversionStatus.Simplifying,
        ConversionStatus.Finalizing,
        ConversionStatus.Complete
      ];

      const currentStatusIndex = statusOrder.indexOf(conversion.status as ConversionStatus);

      newSteps.forEach((step, index) => {
        if (index < currentStatusIndex) {
          step.status = 'complete';
        } else if (index === currentStatusIndex) {
          step.status = 'processing';
        } else {
          step.status = 'pending';
        }
      });

      // If conversion is complete, mark all steps as complete
      if (conversion.status === ConversionStatus.Complete) {
        newSteps.forEach(step => step.status = 'complete');
      }

      return newSteps;
    });
  }, [conversion]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-4">
        <Header />
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Show error state if conversion is still not available after loading
  if (!conversion) {
    return (
      <div className="p-4">
        <Header />
        <div className="text-center py-8 text-red-400">
          Conversion not found
        </div>
      </div>
    );
  }

  const handleContinue = () => {
    router.refresh();
  };

  const isComplete = conversion.status === ConversionStatus.Complete;

  return (
    <div className="p-4">
      <Header />
      <div className="space-y-1">
        {steps.map((step, index) => {
          const statusOrder = [
            ConversionStatus.Analyzing,
            ConversionStatus.Sorting,
            ConversionStatus.Templating,
            ConversionStatus.Normalizing,
            ConversionStatus.Simplifying,
            ConversionStatus.Finalizing,
            ConversionStatus.Complete
          ];
          const currentStatusIndex = statusOrder.indexOf(conversion.status as ConversionStatus);

          // Skip rendering steps past the current one
          if (index > currentStatusIndex) {
            return null;
          }

          return (
            <StepItem
              key={step.id}
              step={step}
              conversion={conversion}
              isCurrent={index === currentStatusIndex}
              isPrevious={index < currentStatusIndex}
              isFuture={false} // We no longer need this since future steps won't be rendered
            />
          );
        })}
      </div>
      {isComplete && (
        <ContinueButton onClick={handleContinue} />
      )}
    </div>
  );
}
