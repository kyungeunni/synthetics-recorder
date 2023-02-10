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
import path from 'path';
import { writeFile, rm, mkdir } from 'fs/promises';
import { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import logger from 'electron-log';
// import isDev from 'electron-is-dev';
import type {
  ActionInContext,
  RecorderSteps,
  RunJourneyOptions,
  StepEndEvent,
  Steps,
  StepStatus,
  TestEvent,
} from '../../common/types';

const DEFAULT_ARGS = [
  '--no-headless',
  '--reporter=json',
  '--screenshots=off',
  '--no-throttling',
  '--sandbox',
];

import { JOURNEY_DIR } from '../config';
import { CliStdio, SyntheticsManager } from '../syntheticsManager';
import { getBrowserWindow } from '../util';

export async function runJourney(
  _event: IpcMainInvokeEvent,
  data: RunJourneyOptions,
  syntheticsManager: SyntheticsManager
) {
  if (syntheticsManager.isRunning()) {
    throw new Error('Synthetics test is already running');
  }

  try {
    const runJourney = data.isProject ? runProjectJourney : runInlineJourney;
    await runJourney(syntheticsManager, data);
  } catch (error: unknown) {
    logger.error(error);
    sendTestEvent({
      event: 'journey/end',
      data: {
        status: 'failed',
        error: error as Error,
      },
    });
  } finally {
    await syntheticsManager.stop();
  }
}

export async function runInlineJourney(syntheticsManager: SyntheticsManager, data: RunJourneyOptions) {
  const args = [
    ...DEFAULT_ARGS,
    '--inline'
  ];

  const stdio = syntheticsManager.run(args);
  stdio.stdin?.write(data.code);
  stdio.stdin?.end();
  await consumeResult(stdio, data.steps);
}

export async function runProjectJourney(syntheticsManager: SyntheticsManager, data: RunJourneyOptions) {
  const filePath = path.join(JOURNEY_DIR, 'recorded.journey.js');
  await mkdir(JOURNEY_DIR, { recursive: true });
  await writeFile(filePath, data.code);
  const args = [
    filePath,
    ...DEFAULT_ARGS,
  ];
  const stdio = syntheticsManager.run(args);
  await consumeResult(stdio, data.steps);
  // cleanup
  await rm(filePath, { recursive: true, force: true });
}

async function consumeResult({ stdout, stderr }: CliStdio, steps: Steps) {
  stdout.setEncoding('utf-8');
  stderr.setEncoding('utf-8');
  for await (const chunk of stdout!) {
    parseOrSkip(chunk).forEach(parsed => {
      const event = constructEvent(parsed);
      if (event) {
        sendTestEvent(
          event.event === 'step/end' ? addActionsToStepResult(steps, event) : event
        );
      }
    });
  }
  for await (const chunk of stderr!) {
    logger.error(chunk);
  }
}

function constructEvent(parsed: Record<string, any>): TestEvent | null {
  const isJourneyStart = (event: any): event is { journey: { name: string } } => {
    return event.type === 'journey/start' && !!event.journey.name;
  };

  const isStepEnd = (
    event: any
  ): event is {
    step: { duration: { us: number }; name: string; status: StepStatus };
    error?: Error;
  } => {
    return (
      event.type === 'step/end' &&
      ['succeeded', 'failed', 'skipped'].includes(event.step?.status) &&
      typeof event.step?.duration?.us === 'number'
    );
  };

  const isJourneyEnd = (
    event: any
  ): event is { journey: { name: string; status: 'succeeded' | 'failed' } } => {
    return (
      event.type === 'journey/end' && ['succeeded', 'failed'].includes(event.journey?.status)
    );
  };

  if (isJourneyStart(parsed)) {
    return {
      event: 'journey/start',
      data: {
        name: parsed.journey.name,
      },
    };
  }

  if (isStepEnd(parsed)) {
    return {
      event: 'step/end',
      data: {
        name: parsed.step.name,
        status: parsed.step.status,
        duration: Math.ceil(parsed.step.duration.us / 1000),
        error: parsed.error,
      },
    };
  }
  if (isJourneyEnd(parsed)) {
    return {
      event: 'journey/end',
      data: {
        name: parsed.journey.name,
        status: parsed.journey.status,
      },
    };
  }
  return null;
};

function parseOrSkip(chunk: string): Array<Record<string, any>> {
  // at times stdout ships multiple steps in one chunk, broken by newline,
  // so here we split on the newline
  return chunk.split('\n').map(subChunk => {
    try {
      return JSON.parse(subChunk);
    } catch (_) {
      return {};
    }
  });
};

function sendTestEvent(event: TestEvent) {
  const browserWindow = getBrowserWindow();
  browserWindow.webContents.send('test-event', event);
};

/**
 * Attempts to find the step associated with a `step/end` event.
 *
 * If the step is found, the sequential titles of each action are overlayed
 * onto the object.
 * @param {*} steps list of steps to search
 * @param {*} event the result data from Playwright
 * @returns the event data combined with action titles in a new object
 */
function addActionsToStepResult(steps: RecorderSteps, event: StepEndEvent): TestEvent {
  const step = steps.find(
    s =>
      s.actions.length &&
      s.actions[0].title &&
      (event.data.name === s.actions[0].title || event.data.name === s.name)
  );
  if (!step) return { ...event, data: { ...event.data, actionTitles: [] } };
  return {
    ...event,
    data: {
      ...event.data,
      actionTitles: step.actions.map(
        (action: ActionInContext, index: number) => action?.title ?? `Action ${index + 1}`
      ),
    },
  };
}
