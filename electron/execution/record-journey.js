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
const { resolve } = require("path");
const { existsSync } = require("fs");
const { ipcMain: ipc } = require("electron-better-ipc");
const { EventEmitter, once } = require("events");
const logger = require("electron-log");
const { EXECUTABLE_PATH } = require("../config");

const IS_TEST_ENV = process.env.NODE_ENV === "test";
const CDP_TEST_PORT = parseInt(process.env.TEST_PORT ?? 61337) + 1;

async function launchContext() {
  const browser = await chromium.launch({
    headless: IS_TEST_ENV,
    executablePath: EXECUTABLE_PATH,
    args: IS_TEST_ENV ? [`--remote-debugging-port=${CDP_TEST_PORT}`] : [],
  });

  const context = await browser.newContext();

  let closingBrowser = false;
  async function closeBrowser() {
    if (closingBrowser) return;
    closingBrowser = true;
    await browser.close();
  }

  context.on("page", page => {
    page.on("dialog", () => {});
    page.on("close", () => {
      const hasPage = browser
        .contexts()
        .some(context => context.pages().length > 0);
      if (hasPage) return;
      closeBrowser().catch(_e => null);
    });
  });
  return { browser, context };
}

async function openPage(context, url) {
  const page = await context.newPage();
  if (url) {
    if (existsSync(url)) url = "file://" + resolve(url);
    else if (
      !url.startsWith("http") &&
      !url.startsWith("file://") &&
      !url.startsWith("about:")
    )
      url = "http://" + url;
    await page.goto(url);
  }
  return page;
}

let browserContext = null;
let actionListener = new EventEmitter();

exports.recordJourneys = async function recordJourneys(data, browserWindow) {
  try {
    const { browser, context } = await launchContext();
    browserContext = context;
    actionListener = new EventEmitter();
    // Listen to actions from Playwright recording session
    const actionsHandler = actions => {
      ipc.callRenderer(browserWindow, "change", { actions });
    };
    actionListener.on("actions", actionsHandler);

    await context._enableRecorder({
      launchOptions: {},
      contextOptions: {},
      startRecording: true,
      showRecorder: false,
      actionListener,
    });
    await openPage(context, data.url);

    const closeBrowser = async () => {
      browserContext = null;
      actionListener.removeListener("actions", actionsHandler);
      await browser.close().catch({});
    };

    ipc.on("stop", closeBrowser);

    await once(browser, "disconnected");
  } catch (e) {
    logger.error(e);
  }
};

exports.onSetMode = async function onSetMode(mode) {
  if (!browserContext) return;
  const page = browserContext.pages()[0];
  if (!page) return;
  await page.mainFrame().evaluate(
    ([mode]) => {
      window._playwrightSetMode(mode);
    },
    [mode]
  );
  if (mode !== "inspecting") return;
  const [selector] = await once(actionListener, "selector");
  return selector;
};
