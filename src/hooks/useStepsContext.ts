/*
MIT License

Copyright (c) 2021-present, Elastic NV

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

import { ActionInContext } from "@elastic/synthetics";
import { useState } from "react";
import type { Step, Steps } from "../common/types";
import type { IStepsContext } from "../contexts/StepsContext";

const example: Steps = [
  [
    {
      pageAlias: "page",
      isMainFrame: true,
      frameUrl: "https://www.google.com/?gws_rd=ssl",
      committed: true,
      action: {
        name: "navigate",
        url: "https://www.google.com/?gws_rd=ssl",
        signals: [],
      },
      title: "Go to https://www.google.com/?gws_rd=ssl",
    },
  ],
  [
    {
      pageAlias: "page",
      isMainFrame: true,
      frameUrl: "https://www.google.com/?gws_rd=ssl",
      action: {
        name: "click",
        selector: 'button:has-text("I agree")',
        signals: [],
        button: "left",
        modifiers: 0,
        clickCount: 1,
      },
      committed: true,
      title: 'Click button:has-text("I agree")',
    },
    {
      pageAlias: "page",
      isMainFrame: true,
      frameUrl: "https://www.google.com/?gws_rd=ssl",
      action: {
        name: "click",
        selector: '[aria-label="Search"]',
        signals: [],
        button: "left",
        modifiers: 0,
        clickCount: 1,
      },
      committed: true,
      title: 'Click [aria-label="Search"]',
    },
    {
      pageAlias: "page",
      isMainFrame: true,
      frameUrl: "https://www.google.com/?gws_rd=ssl",
      action: {
        name: "fill",
        selector: '[aria-label="Search"]',
        signals: [],
        text: "weather",
      },
      committed: true,
      title: 'Fill [aria-label="Search"]',
    },
    {
      pageAlias: "page",
      isMainFrame: true,
      frameUrl: "https://www.google.com/?gws_rd=ssl",
      action: {
        name: "press",
        selector: '[aria-label="Search"]',
        signals: [
          {
            name: "navigation",
            url: "https://www.google.com/search?q=weather&source=hp&ei=RCgiYtSDDoGJlwSJrYMg&iflsig=AHkkrS4AAAAAYiI2VDpSHj-gvw4qYH79KF6itXRTP3_z&ved=0ahUKEwjUtayX26z2AhWBxIUKHYnWAAQQ4dUDCAc&uact=5&oq=weather&gs_lcp=Cgdnd3Mtd2l6EAMyCggAEIAEEEYQgAIyBQgAEIAEMggIABCABBDJAzIFCAAQkgMyBQgAEIAEMgUIABCABDIFCAAQgAQyBQgAEIAEMgUIABCABDIFCAAQgAQ6BQguEIAEOgsILhCABBDHARDRAzoOCC4QgAQQxwEQ0QMQ1AI6CwguEIAEEMcBEKMCOggILhCABBDUAlCUCFjFEmDZFGgBcAB4AIABWIgBnwSSAQE3mAEAoAEBsAEA&sclient=gws-wiz",
          },
          {
            name: "navigation",
            url: "https://www.google.com/search?q=weather&source=hp&ei=RCgiYtSDDoGJlwSJrYMg&iflsig=AHkkrS4AAAAAYiI2VDpSHj-gvw4qYH79KF6itXRTP3_z&ved=0ahUKEwjUtayX26z2AhWBxIUKHYnWAAQQ4dUDCAc&uact=5&oq=weather&gs_lcp=Cgdnd3Mtd2l6EAMyCggAEIAEEEYQgAIyBQgAEIAEMggIABCABBDJAzIFCAAQkgMyBQgAEIAEMgUIABCABDIFCAAQgAQyBQgAEIAEMgUIABCABDIFCAAQgAQ6BQguEIAEOgsILhCABBDHARDRAzoOCC4QgAQQxwEQ0QMQ1AI6CwguEIAEEMcBEKMCOggILhCABBDUAlCUCFjFEmDZFGgBcAB4AIABWIgBnwSSAQE3mAEAoAEBsAEA&sclient=gws-wiz",
            isAsync: true,
          },
        ],
        key: "Enter",
        modifiers: 0,
      },
      committed: true,
      title: "Press Enter",
    },
    {
      pageAlias: "page",
      isMainFrame: true,
      frameUrl:
        "https://www.google.com/search?q=weather&source=hp&ei=RCgiYtSDDoGJlwSJrYMg&iflsig=AHkkrS4AAAAAYiI2VDpSHj-gvw4qYH79KF6itXRTP3_z&ved=0ahUKEwjUtayX26z2AhWBxIUKHYnWAAQQ4dUDCAc&uact=5&oq=weather&gs_lcp=Cgdnd3Mtd2l6EAMyCggAEIAEEEYQgAIyBQgAEIAEMggIABCABBDJAzIFCAAQkgMyBQgAEIAEMgUIABCABDIFCAAQgAQyBQgAEIAEMgUIABCABDIFCAAQgAQ6BQguEIAEOgsILhCABBDHARDRAzoOCC4QgAQQxwEQ0QMQ1AI6CwguEIAEEMcBEKMCOggILhCABBDUAlCUCFjFEmDZFGgBcAB4AIABWIgBnwSSAQE3mAEAoAEBsAEA&sclient=gws-wiz",
      action: {
        name: "click",
        selector: "text=Lido di Ostia - BBC Weather",
        signals: [
          {
            name: "navigation",
            url: "https://www.bbc.com/weather/3174741",
          },
        ],
        button: "left",
        modifiers: 0,
        clickCount: 1,
      },
      title: "Click text=Lido di Ostia - BBC Weather",
    },
  ],
];

export function useStepsContext(): IStepsContext {
  const [steps, setSteps] = useState<Steps>(example);
  const [breakpoints, setBreakpoints] = useState<Set<string>>(new Set());
  const onStepDetailChange = (updatedStep: Step, indexToUpdate: number) => {
    setSteps(
      steps.map((currentStep, iterIndex) =>
        // if the `currentStep` is at the `indexToUpdate`, return `updatedStep` instead of stale object
        iterIndex === indexToUpdate ? updatedStep : currentStep
      )
    );
  };
  return {
    steps,
    breakpoints,
    setSteps,
    onDeleteAction: (targetStepIdx, indexToDelete) => {
      setSteps(steps =>
        steps.map((step, currentStepIndex) => {
          if (currentStepIndex !== targetStepIdx) return step;

          step.splice(indexToDelete, 1);

          return [...step];
        })
      );
    },
    onDeleteStep: stepIndex => {
      setSteps([...steps.slice(0, stepIndex), ...steps.slice(stepIndex + 1)]);
    },
    onInsertAction: (action, targetStepIdx, indexToInsert) => {
      setSteps(
        steps.map((step, currentStepIndex) => {
          if (currentStepIndex !== targetStepIdx) return step;

          step.splice(indexToInsert, 0, action);

          return [...step];
        })
      );
    },
    onStepDetailChange,
    onUpdateAction: (
      action: ActionInContext,
      stepIndex: number,
      actionIndex: number
    ) => {
      const step = steps[stepIndex];
      onStepDetailChange(
        [
          ...step.slice(0, actionIndex),
          action,
          ...step.slice(actionIndex + 1, step.length),
        ],
        stepIndex
      );
    },
    onToggleBreakpoint: (stepIndex: number, actionIndex: number) => {
      const key = `${stepIndex}:${actionIndex}`;
      const copySet = new Set([...breakpoints]);
      copySet.has(key) ? copySet.delete(key) : copySet.add(key);
      setBreakpoints(copySet);
    },
  };
}
