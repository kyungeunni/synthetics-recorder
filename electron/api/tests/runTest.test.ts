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
import {expect, jest, test} from '@jest/globals';
import { runJourney } from '../runJourney';
import { SyntheticsManager } from '../../syntheticsManager';
import { RunJourneyOptions, Step } from '../../../common/types';
import type { getBrowserWindow } from '../../util';

jest.mock('../../util');

let mockedBrowserWindow;
let windowSend;

beforeEach(() => {
  mockedBrowserWindow = jest.Mocked<typeof getBrowserWindow>;
  windowSend = jest.fn();

  mockedBrowserWindow.mockImplementation(() => {
    // Yes, this mock is still adding two numbers but imagine this
    // was a complex function we are mocking.
    return { 
      webContents: {
        send: windowSend
      }
    };
  });

});

afterEach(() => {
  mockedBrowserWindow.mockClear();
});

describe('runJourney', () => {
  const step: Step = {
    actions: [{
      frame: {
        pageAlias: 'page',
        isMainFrame: true,
        url: 'http://example.com',
      },
      action: {
        name: 'navigate',
        signals: [],
        url: 'https://www.elastic.co',
      },
    }],
    name: 'step 1',
  };

  const options: RunJourneyOptions = {
    steps: [step],
    code: 'console.log("hello")',
    isProject: false,
  }

  it('does not start if browser is running', async () => {
    const syntheticsManager = new SyntheticsManager();
    syntheticsManager.isRunning = jest.fn(() => true);
    await expect(runJourney({} as any,  options, syntheticsManager)).rejects.toThrowError('Synthetics test is already running');
  });

  describe('isProject: false', () => {
    it('adds `--inline` to args when launching synthetics agent', async () => {
      const syntheticsManager = new SyntheticsManager();
      jest.mock('')
      // TODO: mock run method and check the args and options
      const runMock = jest.fn((args, options) => {
        console.log({ args, options });
        throw new Error('eee');
      });
      syntheticsManager.run = runMock;
      try {
        await runJourney({} as any,  options, syntheticsManager);
      } catch (err) {
        console.error(err);
      }
      expect(runMock).toBeCalledWith([]);
    });
    // it('provides script using stdin');
    // it('emits output and deliver events to renderer process via `test-event` channel');
  });

  // describe('isProject: true', () => {
  //   it('creates temporary script');
  //   it('adds filepath to args when launching synthetics agent');
  //   it('emits output and deliver events to renderer process via `test-event` channel');
  //   it('removes temp file after synthetics agent is finished');
  // });

  // describe('constructEvent()', () => {
  //   it('parses and constructs `journey/start` event type');
  //   it('parses and construct `journey/end event type`');
  //   it('parses and construct `step/end` event type');
  //   it('adds action titles to `step/end` event');
  //   it('ignores unknown output');
  // });

  // it('sends `journey/end` event when ');
});
