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
import { fork, ChildProcess, ForkOptions } from 'child_process';
import { Readable, Writable } from 'node:stream';
import logger from 'electron-log';
const SYNTHETICS_CLI = require.resolve('@elastic/synthetics/dist/cli');

export class SyntheticsManager {
  protected _cliProcess: ChildProcess | null = null;

  isRunning() {
    return !!this._cliProcess;
  }

  /**
   * Fork the Synthetics CLI with correct browser path and
   * cwd correctly spawns the process
   */
  run(args: string[], options: ForkOptions) {
    const ps = fork(`${SYNTHETICS_CLI}`, args, options);
    this._cliProcess = ps;
    const { stdout, stdin, stderr } = ps;
    return { stdout, stdin, stderr };
  }

  stop() {
    if (this._cliProcess && !this._cliProcess.kill()) {
      logger.warn('Unable to abort Synthetics test process.');
    }
    this._cliProcess = null;
  }
}

class SyntheticsManagerMock extends SyntheticsManager {
  protected _isRunning: boolean = false;

  isRunning() {
    return this._isRunning;
  }

  setIsRunning(val: boolean) {
    this._isRunning = val;
  }

  // run(args: string[], options: ForkOptions) {
  //   var stdout = new Readable();
  //   var stderr = new Readable();
  //   var stdin = new Writable();
  //     return { stdout, stdin, stderr }
  //   }
  // }
}

export const syntheticsManager = new SyntheticsManager();
