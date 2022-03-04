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

import type { ActionInContext } from "@elastic/synthetics";
import { createContext } from "react";
import type { Setter, Step, Steps } from "../common/types";

function notImplemented() {
  throw Error("Step context not initialized");
}

export interface IStepsContext {
  /**
   * Represents the actions and assertions that the user has recorded.
   */
  steps: Steps;
  /**
   * Track break points, format: stepIndex:actionIndex
   */
  breakpoints: Set<string>;
  /**
   * Updates the steps.
   */
  setSteps: Setter<Steps>;
  /**
   * Deletes the action at the `actionIndex` in the given step.
   */
  onDeleteAction: (stepIndex: number, actionIndex: number) => void;
  onDeleteStep: (stepIndex: number) => void;
  /**
   * Inserts the `action` to the given step at `actionIndex`.
   */
  onInsertAction: (
    action: ActionInContext,
    stepIndex: number,
    actionIndex: number
  ) => void;
  onUpdateAction: (
    action: ActionInContext,
    stepIndex: number,
    actionIndex: number
  ) => void;
  /**
   * Overwrites the step at `stepIndex` with `step`.
   */
  onStepDetailChange: (step: Step, stepIndex: number) => void;
  onToggleBreakpoint: (stepIndex: number, actionIndex: number) => void;
}

const example = [
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
        signals: [
          {
            name: "navigation",
            url: "https://www.google.com/?gws_rd=ssl",
            isAsync: true,
          },
        ],
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
        text: "dss",
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
        signals: [],
        key: "a",
        modifiers: 4,
      },
      committed: true,
      title: "Press a with modifiers",
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
  ],
  [
    {
      pageAlias: "page",
      isMainFrame: true,
      frameUrl: "https://www.google.com/?gws_rd=ssl",
      action: {
        name: "click",
        selector:
          "text=Thu - Lido di Ostia Levante, Ostia, Metropolitan City of Rome",
        signals: [
          {
            name: "navigation",
            url: "https://www.google.com/search?q=weather&source=hp&ei=wxMhYp78HuqFxc8PubWX0Aw&iflsig=AHkkrS4AAAAAYiEh08SeBYfSXzeGy-SvHB1YXGHPxJcO&oq=weather&gs_lcp=Cgdnd3Mtd2l6EAEYADIKCAAQgAQQRhCAAjIFCAAQgAQyCAgAEIAEEMkDMgUIABCSAzIFCAAQgAQyBQgAEIAEMgUIABCABDIFCAAQgAQyBQgAEIAEMgUIABCABDoLCC4QgAQQxwEQowI6CAguEIAEENQCOgsILhCABBDHARDRAzoFCC4QgAQ6DgguEIAEEMcBEKMCENQCOgsILhCABBDHARCvAToNCC4QgAQQxwEQowIQCjoOCC4QgAQQxwEQ0QMQ1AJQiAFY2Blg4yJoAXAAeACAAWqIAZcGkgEDOS4xmAEAoAEBsAEA&sclient=gws-wiz",
          },
          {
            name: "navigation",
            url: "https://www.google.com/search?q=weather&source=hp&ei=wxMhYp78HuqFxc8PubWX0Aw&iflsig=AHkkrS4AAAAAYiEh08SeBYfSXzeGy-SvHB1YXGHPxJcO&oq=weather&gs_lcp=Cgdnd3Mtd2l6EAEYADIKCAAQgAQQRhCAAjIFCAAQgAQyCAgAEIAEEMkDMgUIABCSAzIFCAAQgAQyBQgAEIAEMgUIABCABDIFCAAQgAQyBQgAEIAEMgUIABCABDoLCC4QgAQQxwEQowI6CAguEIAEENQCOgsILhCABBDHARDRAzoFCC4QgAQ6DgguEIAEEMcBEKMCENQCOgsILhCABBDHARCvAToNCC4QgAQQxwEQowIQCjoOCC4QgAQQxwEQ0QMQ1AJQiAFY2Blg4yJoAXAAeACAAWqIAZcGkgEDOS4xmAEAoAEBsAEA&sclient=gws-wiz",
            isAsync: true,
          },
        ],
        button: "left",
        modifiers: 0,
        clickCount: 1,
      },
      committed: true,
      title:
        "Click text=Thu - Lido di Ostia Levante, Ostia, Metropolitan City of Rome",
    },
    {
      pageAlias: "page",
      isMainFrame: true,
      frameUrl:
        "https://www.google.com/search?q=weather&source=hp&ei=wxMhYp78HuqFxc8PubWX0Aw&iflsig=AHkkrS4AAAAAYiEh08SeBYfSXzeGy-SvHB1YXGHPxJcO&oq=weather&gs_lcp=Cgdnd3Mtd2l6EAEYADIKCAAQgAQQRhCAAjIFCAAQgAQyCAgAEIAEEMkDMgUIABCSAzIFCAAQgAQyBQgAEIAEMgUIABCABDIFCAAQgAQyBQgAEIAEMgUIABCABDoLCC4QgAQQxwEQowI6CAguEIAEENQCOgsILhCABBDHARDRAzoFCC4QgAQ6DgguEIAEEMcBEKMCENQCOgsILhCABBDHARCvAToNCC4QgAQQxwEQowIQCjoOCC4QgAQQxwEQ0QMQ1AJQiAFY2Blg4yJoAXAAeACAAWqIAZcGkgEDOS4xmAEAoAEBsAEA&sclient=gws-wiz",
      action: {
        name: "click",
        selector:
          "text=National and Local Weather Radar, Daily Forecast, Hurricane ...",
        signals: [
          {
            name: "navigation",
            url: "https://weather.com/?Goto=Redirected",
          },
          {
            name: "navigation",
            url: "https://weather.com/?Goto=Redirected",
            isAsync: true,
          },
        ],
        button: "left",
        modifiers: 0,
        clickCount: 1,
      },
      title:
        "Click text=National and Local Weather Radar, Daily Forecast, Hurricane ...",
    },
  ],
];

export const StepsContext = createContext<IStepsContext>({
  steps: example as Steps, //[],
  breakpoints: new Set(),
  setSteps: notImplemented,
  onDeleteAction: notImplemented,
  onDeleteStep: notImplemented,
  onInsertAction: notImplemented,
  onStepDetailChange: notImplemented,
  onUpdateAction: notImplemented,
  onToggleBreakpoint: notImplemented,
});
