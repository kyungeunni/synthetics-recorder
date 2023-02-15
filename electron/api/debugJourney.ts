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
import { Browser, BrowserContext, chromium, Page } from 'playwright';
import { SyntheticsGenerator } from '../syntheticsGenerator';

import { expect } from '@elastic/synthetics';
import { EXECUTABLE_PATH } from '../config';
import { DebugParams, ActionInContext } from '../../common/types';
import { app, IpcMainInvokeEvent } from 'electron';
import { getMainWindow } from '../util';
type Session = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

export type DebugResult = {
  finished: boolean;
  paused: boolean;
  pausedIndex: string;
  error: Error | null;
};

class JourneyDebugRunner {
  codeGenerator: SyntheticsGenerator;
  _closingBrowser = false;
  session: Session | null = null;
  pausedIndex = '';

  constructor() {
    this.codeGenerator = new SyntheticsGenerator(false);
  }
  /**
   *
   * @param {Array<ActionInContext>} steps
   * @param {Set<string>} breakpoints
   * @returns
   */
  async startDebug({ steps, breakpoints }: DebugParams): Promise<DebugResult | void> {
    if (this.session) {
      console.log('session exists');
      return;
    }
    await this.startSession();
    console.log('breakpoints:', [...breakpoints]);
    for (const [stepIndex, step] of steps.entries()) {
      for (const [actionIndex, action] of step.actions.entries()) {
        const key = stepIndex + ':' + actionIndex;
        const result = await this.runAction({ key, breakpoints, action });
        if (result) {
          app.focus({ steal: true });
          return result;
        }
      }
    }

    await this.closeBrowser();
    return {
      finished: true,
      paused: false,
      pausedIndex: '',
      error: null,
    };
  }

  async runAction({
    key,
    breakpoints,
    action,
  }: {
    key: string;
    breakpoints: Set<string>;
    action: ActionInContext;
  }) {
    if (this.pausedIndex !== key && breakpoints.has(key)) {
      this.pausedIndex = key;
      return {
        finished: false,
        paused: true,
        pausedIndex: key,
        error: null,
      };
    }

    try {
      await this.evaluateAction(this.session!.page, action);
    } catch (err) {
      console.error(err);
      this.closeBrowser().catch(_e => console.error);
      return {
        finished: true,
        paused: false,
        pausedIndex: '',
        error: new Error(`Failed to run action ${action.title}. Run Test to see the details`),
      };
    }
    return null;
  }

  async resume({ steps, breakpoints }: DebugParams) {
    console.log('this.pausedIndex', this.pausedIndex);
    if (!this.session) {
      return;
    }
    const [pStepIndex, pActionIndex] = this.pausedIndex.split(':').map(idx => Number(idx));
    if (isNaN(pStepIndex) || pStepIndex == null || isNaN(pActionIndex) || pActionIndex == null) {
      return;
    }
    const { page } = this.session;
    await page.bringToFront();
    for (const [stepIndex, step] of steps.entries()) {
      if (stepIndex < pStepIndex) {
        console.log('stepIndex:', stepIndex, 'continued');
        continue;
      }
      for (const [actionIndex, action] of step.actions.entries()) {
        if (stepIndex === pStepIndex && Number(actionIndex) < pActionIndex) {
          console.log('stepIndex, actionIndex: ', actionIndex, stepIndex, 'continued');
          continue;
        }
        const key = stepIndex + ':' + actionIndex;
        const result = await this.runAction({ key, breakpoints, action });
        if (result) {
          app.focus({ steal: true });
          return result;
        }
      }
    }
    await this.closeBrowser();
    return {
      finished: true,
      paused: false,
      pausedIndex: '',
      error: null,
    };
  }

  async startSession() {
    const { browser, context } = await this.launchBrowser();
    const page = await context.newPage();
    this.session = {
      browser,
      context,
      page,
    };
    return { ...this.session };
  }

  resetSession() {
    this.session = null;
    this.pausedIndex = '';
  }

  async launchBrowser() {
    const browser = await chromium.launch({
      headless: false,
      executablePath: EXECUTABLE_PATH,
      chromiumSandbox: true,
    });

    const context = await browser.newContext();

    context.on('page', page => {
      page.on('close', () => {
        const hasPage = browser.contexts().some(context => context.pages().length > 0);
        if (hasPage) return;
        this.closeBrowser().catch(_e => null);
        this.resetSession();
      });
    });
    return { browser, context };
  }

  async closeBrowser() {
    if (this.session == null || this.session.browser == null) {
      return;
    }
    const { browser } = this.session;
    if (this._closingBrowser) return;
    this._closingBrowser = true;
    await browser.close();
    this.resetSession();
    this._closingBrowser = false;
  }

  async evaluateAction(page: Page, action: ActionInContext) {
    const code = this.codeGenerator.generateAction(action);
    const globals = ['module', 'exports', 'require', 'global', 'process'];
    const js = new Function(
      'page',
      'expect',
      `return (async (${globals.join(',')}) => { ${code} })(page, expect)`
    );
    await js(page, expect);
  }
}

const debugRunner = new JourneyDebugRunner();

export const startDebug = async (_event: IpcMainInvokeEvent, params: DebugParams) =>
  debugRunner.startDebug(params);

export const resumeDebug = async (_event: IpcMainInvokeEvent, params: DebugParams) =>
  debugRunner.resume(params);

export const resetDebug = async (_event: IpcMainInvokeEvent) => {
  debugRunner.resetSession();
};
