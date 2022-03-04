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
const { chromium } = require("playwright");
const {
  SyntheticsGenerator,
} = require("@elastic/synthetics/dist/formatter/javascript");

const { expect, step } = require("@elastic/synthetics");
const { EXECUTABLE_PATH } = require("../config");

class JourneyDebugRunner {
  _closingBrowser = false;
  session = null;
  pausedIndex = "";

  constructor() {
    this.codeGenerator = new SyntheticsGenerator();
  }
  /**
   *
   * @param {Array<ActionInContext>} steps
   * @param {Set<string>} breakpoints
   * @returns
   */
  async startDebug(steps, breakpoints) {
    if (this.session) {
      return;
    }
    const { page } = await this.startSession();
    console.log("breakpoints:", [...breakpoints]);
    for (const [stepIndex, step] of steps.entries()) {
      for (const [actionIndex, action] of step.entries()) {
        const key = stepIndex + ":" + actionIndex;
        console.log({ key });
        if (breakpoints.has(key)) {
          this.pausedIndex = key;

          return {
            finished: false,
            paused: true,
            pausedIndex: key,
          };
        }
        try {
          await this.runAction(page, action);
        } catch (err) {
          console.error(err);
          this.closeBrowser().catch(_e => null);
          throw err;
        }
      }
    }

    await this.closeBrowser();
    return {
      finished: true,
      paused: false,
      pausedIndex: null,
    };
  }

  async resume(steps, breakpoints) {
    console.log("this.pausedIndex", this.pausedIndex);
    if (!this.session) {
      return;
    }
    const [pStepIndex, pActionIndex] = this.pausedIndex.split(":");
    if (pStepIndex == null || pActionIndex == null) {
      return;
    }
    const { page } = this.session;
    await page.bringToFront();
    for (const [stepIndex, step] of steps.entries()) {
      if (stepIndex < pStepIndex) {
        console.log("stepIndex:", stepIndex, "continued");
        continue;
      }
      for (const [actionIndex, action] of step.entries()) {
        if (actionIndex < pActionIndex) {
          console.log(
            "actionIndex, stepIndex: ",
            actionIndex,
            stepIndex,
            "continued"
          );
          continue;
        }

        const key = stepIndex + ":" + actionIndex;
        if (this.pausedIndex !== key && breakpoints.has(key)) {
          this.pausedIndex = key;
          return {
            finished: false,
            paused: true,
            pausedIndex: key,
          };
        }

        try {
          await this.runAction(page, action);
        } catch (err) {
          console.error(err);
          this.closeBrowser().catch(_e => null);
          throw err;
        }
      }
    }
    await this.closeBrowser();
    return {
      finished: true,
      paused: false,
      pausedIndex: null,
    };
  }

  async startSession() {
    const { browser, context } = await this.launchBrowser();
    const page = await context.newPage();
    this.page = page;
    this.session = {
      browser,
      context,
      page,
    };
    return { ...this.session };
  }

  resetSession() {
    this.session = null;
  }

  async launchBrowser() {
    const browser = await chromium.launch({
      headless: false,
      executablePath: EXECUTABLE_PATH,
    });

    const context = await browser.newContext();

    context.on("page", page => {
      page.on("dialog", () => {});
      page.on("close", () => {
        const hasPage = browser
          .contexts()
          .some(context => context.pages().length > 0);
        if (hasPage) return;
        this.closeBrowser().catch(_e => null);
      });
    });
    return { browser, context };
  }

  async closeBrowser() {
    const { browser } = this.session;
    if (!browser || this._closingBrowser) return;
    this._closingBrowser = true;
    await browser.close();
    this.resetSession();
  }

  async runAction(page, action) {
    const code = this.codeGenerator.generateAction(action);
    const globals = ["module", "exports", "require", "global", "process"];
    const js = new Function(
      "page",
      "expect",
      `return (async (${globals.join(",")}) => { ${code} })(page, expect)`
    );
    await js(page, expect);
  }
}

const debugRunner = new JourneyDebugRunner();
exports.startDebug = async ({ steps, breakpoints }) =>
  await debugRunner.startDebug(steps, breakpoints);
exports.resumeDebug = async ({ steps, breakpoints }) =>
  await debugRunner.resume(steps, breakpoints);
