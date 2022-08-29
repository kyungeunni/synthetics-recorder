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

import { chromium } from 'playwright';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { ipcMain as ipc } from 'electron-better-ipc';
import { EventEmitter, once } from 'events';
import { dialog, shell, BrowserWindow } from 'electron';
import logger from 'electron-log';
import { EXECUTABLE_PATH } from './config';
import type { BrowserContext } from 'playwright-core';
import type {
  ActionInContext,
  GenerateCodeOptions,
  RecorderSteps,
  RecordJourneyOptions,
  RunJourneyOptions,
} from '../common/types';
import { SyntheticsGenerator } from './syntheticsGenerator';
import { TestService } from './run-test';

const IS_TEST_ENV = process.env.NODE_ENV === 'test';
const CDP_TEST_PORT = parseInt(process.env.TEST_PORT ?? '61337') + 1;

export enum MainWindowEvent {
  MAIN_CLOSE = 'main-close',
}

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

  context.on('page', page => {
    page.on('close', () => {
      const hasPage = browser.contexts().some(context => context.pages().length > 0);
      if (hasPage) return;
      closeBrowser().catch(_e => null);
    });
  });
  return { browser, context };
}

async function openPage(context: BrowserContext, url: string) {
  const page = await context.newPage();
  if (url) {
    if (existsSync(url)) url = 'file://' + resolve(url);
    else if (!url.startsWith('http') && !url.startsWith('file://') && !url.startsWith('about:'))
      url = 'http://' + url;
    await page.goto(url);
  }
  return page;
}

let browserContext: BrowserContext | null = null;
let actionListener = new EventEmitter();
let isBrowserRunning = false;

function onRecordJourneys(mainWindowEmitter: EventEmitter) {
  return async function (data: { url: string }, browserWindow: BrowserWindow) {
    if (isBrowserRunning) {
      throw new Error(
        'Cannot start recording a journey, a browser operation is already in progress.'
      );
    }
    isBrowserRunning = true;
    try {
      const { browser, context } = await launchContext();
      const closeBrowser = async () => {
        browserContext = null;
        actionListener.removeListener('actions', actionsHandler);
        try {
          await browser.close();
        } catch (e) {
          logger.error('Browser close threw an error', e);
        }
      };
      ipc.addListener('stop', closeBrowser);
      // Listen to actions from Playwright recording session
      const actionsHandler = (actions: ActionInContext[]) => {
        ipc.callRenderer(browserWindow, 'change', { actions });
      };
      browserContext = context;
      actionListener = new EventEmitter();
      actionListener.on('actions', actionsHandler);

      const handleMainClose = () => {
        actionListener.removeAllListeners();
        ipc.removeListener('stop', closeBrowser);
        browser.close().catch(() => {
          isBrowserRunning = false;
        });
      };

      mainWindowEmitter.addListener(MainWindowEvent.MAIN_CLOSE, handleMainClose);

      // _enableRecorder is private method, not defined in BrowserContext type
      await (context as any)._enableRecorder({
        launchOptions: {},
        contextOptions: {},
        startRecording: true,
        showRecorder: false,
        actionListener,
      });
      await openPage(context, data.url);
      await once(browser, 'disconnected');

      mainWindowEmitter.removeListener(MainWindowEvent.MAIN_CLOSE, handleMainClose);
    } catch (e) {
      logger.error(e);
    } finally {
      isBrowserRunning = false;
    }
  };
}

async function onFileSave(code: string) {
  const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const { filePath, canceled } = await dialog.showSaveDialog(window, {
    filters: [
      {
        name: 'JavaScript',
        extensions: ['js'],
      },
    ],
    defaultPath: 'recorded.journey.js',
  });

  if (!canceled && filePath) {
    await writeFile(filePath, code);
    return true;
  }
  return false;
}

async function onGenerateCode(data: { isProject: boolean; actions: RecorderSteps }) {
  const generator = new SyntheticsGenerator(data.isProject);
  return generator.generateFromSteps(data.actions);
}

async function onSetMode(mode: string) {
  if (!browserContext) return;
  const page = browserContext.pages()[0];
  if (!page) return;
  await page.mainFrame().evaluate(
    ([mode]) => {
      // `_playwrightSetMode` is a private function
      (window as any)._playwrightSetMode(mode);
    },
    [mode]
  );
  if (mode !== 'inspecting') return;
  const [selector] = await once(actionListener, 'selector');
  return selector;
}

async function onLinkExternal(url: string) {
  try {
    await shell.openExternal(url);
  } catch (e) {
    logger.error(e);
  }
}
/**
 * Sets up IPC listeners for the main process to respond to UI events.
 *
 * @param mainWindowEmitter Allows handlers to respond to app-level events
 * @returns a list of functions that will remove the listeners this function adds.
 *
 * Because the IPC is global, it is important to remove the listeners anytime this function's caller
 * is destroyed or they will leak/block the next window from interacting with top-level app state.
 */
export default function setupListeners(mainWindowEmitter: EventEmitter) {
  const testService = new TestService(mainWindowEmitter, { isBrowserRunning });
  return [
    ipc.answerRenderer<RecordJourneyOptions>('record-journey', onRecordJourneys(mainWindowEmitter)),
    ipc.answerRenderer<RunJourneyOptions>(
      'run-journey',
      (options: RunJourneyOptions, browserWindow: BrowserWindow) =>
        testService.run(options, browserWindow)
    ),
    ipc.answerRenderer<GenerateCodeOptions>('actions-to-code', onGenerateCode),
    ipc.answerRenderer<string>('save-file', onFileSave),
    ipc.answerRenderer<string>('set-mode', onSetMode),
    ipc.answerRenderer<string>('link-to-external', onLinkExternal),
  ];
}
