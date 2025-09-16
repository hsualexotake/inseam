"use client";

import { Check, Circle } from "lucide-react";
import { motion } from "framer-motion";
import { Spinner } from "@/components/ui/spinner";

export type StepStatus = "pending" | "active" | "completed";

export interface ProcessingStep {
  id: string;
  title: string;
  description?: string;
  status: StepStatus;
}

interface ProcessingStepsProps {
  steps: ProcessingStep[];
  className?: string;
}

export default function ProcessingSteps({ steps, className = "" }: ProcessingStepsProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <motion.div
              key={step.id}
              className="relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.3,
                delay: index * 0.1,
                ease: "easeOut"
              }}
            >
              <div className="flex items-start gap-4">
                {/* Step indicator with connecting line */}
                <div className="relative flex flex-col items-center">
                  {/* Step icon */}
                  <div className={`
                    relative z-10 flex h-5 w-5 items-center justify-center rounded-full border transition-all
                    ${step.status === 'completed'
                      ? 'border-green-400 bg-green-50'
                      : step.status === 'active'
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 bg-white'
                    }
                  `}>
                    {step.status === 'completed' ? (
                      <Check className="h-2.5 w-2.5 text-green-600" />
                    ) : step.status === 'active' ? (
                      <Spinner variant="ring" size={12} className="text-blue-600" />
                    ) : (
                      <Circle className="h-1.5 w-1.5 text-gray-300" />
                    )}
                  </div>

                  {/* Connecting line */}
                  {!isLast && (
                    <div className={`
                      absolute top-7 w-px h-8 transition-all
                      ${steps[index + 1].status !== 'pending'
                        ? 'bg-gray-300'
                        : 'bg-gray-200'
                      }
                    `} />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 pt-0.5">
                  <h4 className={`
                    text-sm font-medium transition-colors
                    ${step.status === 'completed'
                      ? 'text-gray-700'
                      : step.status === 'active'
                        ? 'text-gray-900'
                        : 'text-gray-400'
                    }
                  `}>
                    {step.title}
                  </h4>

                  {step.description && (
                    <p className={`
                      mt-0.5 text-xs transition-colors
                      ${step.status === 'completed'
                        ? 'text-gray-500'
                        : step.status === 'active'
                          ? 'text-gray-600'
                          : 'text-gray-400'
                      }
                    `}>
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}