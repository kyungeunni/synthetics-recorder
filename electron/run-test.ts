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

import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { fork, ChildProcess } from 'child_process';
import logger from 'electron-log';
import isDev from 'electron-is-dev';
import { JOURNEY_DIR, PLAYWRIGHT_BROWSERS_PATH } from './config';
import type {
  ActionInContext,
  RecorderSteps,
  RunJourneyOptions,
  StepEndEvent,
  StepStatus,
  TestEvent,
} from '../common/types';

const SYNTHETICS_CLI = require.resolve('@elastic/synthetics/dist/cli');

export enum MainWindowEvent {
  MAIN_CLOSE = 'main-close',
  BROWSER_RUNNING_CHANGE = 'is-browser-running',
}

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
    ({ actions, name }) =>
      actions.length &&
      actions[0].title &&
      (event.data.name === actions[0].title || event.data.name === name)
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

export class TestService {
  private syntheticCli: ChildProcess | null;
  constructor(
    protected mainWindowEmitter: EventEmitter,
    protected state: { isBrowserRunning: boolean }
  ) {
    this.syntheticCli = null;
    mainWindowEmitter.addListener(MainWindowEvent.MAIN_CLOSE, () => this.killCli());
    mainWindowEmitter.addListener(
      MainWindowEvent.BROWSER_RUNNING_CHANGE,
      running => (this.state.isBrowserRunning = running)
    );
  }

  async run(data: RunJourneyOptions, browserWindow: BrowserWindow) {
    if (this.state.isBrowserRunning) {
      throw new Error(
        'Cannot start testing a journey, a browser operation is already in progress.'
      );
    }
    this.setBrowserRunning(true);
    data.isProject ? await this.startProjectTest(data) : await this.startInlineTest(data);
    try {
      await this.streamOutput((_error, result) => {
        if (result) this.sendTestEvent(browserWindow, result, data.steps);
      });
    } catch (err) {
      logger.error(err);
    } finally {
      this.killCli();
      this.setBrowserRunning(false);
    }
  }

  protected setBrowserRunning(running: boolean) {
    this.mainWindowEmitter.emit(MainWindowEvent.BROWSER_RUNNING_CHANGE, running);
  }

  async startInlineTest(data: RunJourneyOptions) {
    const args = [...this.getDefaultArgs(), '--inline'];
    this.syntheticCli = await this.forkCli(args);
    const { stdin } = this.syntheticCli;
    stdin?.write(data.code);
    stdin?.end();
  }

  async startProjectTest(data: RunJourneyOptions) {
    const filePath = join(JOURNEY_DIR, 'recorded.journey.js');
    await this.writeTempFile(filePath, data.code);
    const args = [filePath, ...this.getDefaultArgs()];
    this.syntheticCli = await this.forkCli(args);
  }

  protected async writeTempFile(filePath: string, code: string) {
    await mkdir(JOURNEY_DIR, { recursive: true });
    await writeFile(filePath, code);
  }

  protected async streamOutput(
    cb = (error: Error | null, result?: TestEvent) => {
      console.log(result);
    }
  ) {
    if (this.syntheticCli == null) {
      return;
    }
    const { stdout, stderr } = this.syntheticCli;
    stdout?.setEncoding('utf-8');
    stderr?.setEncoding('utf-8');
    for await (const chunk of stdout!) {
      parseOutput(chunk).forEach(parsed => {
        const event = constructEvent(parsed);
        if (event) {
          cb(null, event);
        }
      });
    }
    for await (const chunk of stderr!) {
      logger.error(chunk);
      cb(chunk);
    }
  }

  getDefaultArgs() {
    return ['--no-headless', '--reporter=json', '--screenshots=off', '--no-throttling'];
  }

  protected async forkCli(args: string[]) {
    const cliProcess = fork(`${SYNTHETICS_CLI}`, args, {
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH,
      },
      cwd: isDev ? process.cwd() : process.resourcesPath,
      stdio: 'pipe',
    });

    return cliProcess;
  }

  protected killCli() {
    const killed = this.syntheticCli && this.syntheticCli.kill();
    logger.debug('[kill-cli] Killing Synthetics Cli process...: ', killed ? 'success' : 'failed');
    return killed;
  }

  protected sendTestEvent(browserWindow: BrowserWindow, event: TestEvent, steps: RecorderSteps) {
    const payload = event.event === 'step/end' ? addActionsToStepResult(steps, event) : event;
    browserWindow.webContents.send('test-event', payload);
  }
}

const parseOutput = (chunk: string): Array<Record<string, any>> => {
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
  return event.type === 'journey/end' && ['succeeded', 'failed'].includes(event.journey?.status);
};

const constructEvent = (parsed: Record<string, any>): TestEvent | null => {
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
