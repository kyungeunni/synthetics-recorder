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
const { join } = require("path");
const { writeFile, rm, mkdir } = require("fs/promises");
const { fork } = require("child_process");
const logger = require("electron-log");
const isDev = require("electron-is-dev");
const SYNTHETICS_CLI = require.resolve("@elastic/synthetics/dist/cli");
const { JOURNEY_DIR, PLAYWRIGHT_BROWSERS_PATH } = require("../config");

exports.onTest = async function runJourney(data, browserWindow) {
  const parseOrSkip = chunk => {
    // at times stdout ships multiple steps in one chunk, broken by newline,
    // so here we split on the newline
    return chunk.split("\n").map(subChunk => {
      try {
        return JSON.parse(subChunk);
      } catch (_) {
        return {};
      }
    });
  };

  // returns TestEvent interface defined in common/types.ts
  const constructEvent = parsed => {
    switch (parsed.type) {
      case "journey/start": {
        const { journey } = parsed;
        return {
          event: "journey/start",
          data: {
            name: journey.name,
          },
        };
      }
      case "step/end": {
        const { step, error } = parsed;
        return {
          event: "step/end",
          data: {
            name: step.name,
            status: step.status,
            error,
            duration: Math.ceil(step.duration.us / 1000),
          },
        };
      }
      case "journey/end": {
        const { journey } = parsed;
        return {
          event: "journey/end",
          data: {
            name: journey.name,
            status: journey.status,
          },
        };
      }
    }
  };

  const sendTestEvent = event => {
    browserWindow.webContents.send("test-event", event);
  };

  const emitResult = chunk => {
    parseOrSkip(chunk).forEach(parsed => {
      const event = constructEvent(parsed);
      if (event) {
        sendTestEvent(event);
      }
    });
  };

  let synthCliProcess = null; // child process, define here to kill when finished
  try {
    const isSuite = data.isSuite;
    const args = [
      "--no-headless",
      "--reporter=json",
      "--screenshots=off",
      "--no-throttling",
    ];
    const filePath = join(JOURNEY_DIR, "recorded.journey.js");
    if (!isSuite) {
      args.push("--inline");
    } else {
      await mkdir(JOURNEY_DIR).catch(() => {});
      await writeFile(filePath, data.code);
      args.unshift(filePath);
    }
    /**
     * Fork the Synthetics CLI with correct browser path and
     * cwd correctly spawns the process
     */
    synthCliProcess = fork(`${SYNTHETICS_CLI}`, args, {
      env: {
        PLAYWRIGHT_BROWSERS_PATH,
      },
      cwd: isDev ? process.cwd() : process.resourcesPath,
      stdio: "pipe",
    });
    const { stdout, stdin, stderr } = synthCliProcess;
    if (!isSuite) {
      stdin.write(data.code);
      stdin.end();
    }
    stdout.setEncoding("utf-8");
    stderr.setEncoding("utf-8");
    for await (const chunk of stdout) {
      emitResult(chunk);
    }
    for await (const chunk of stderr) {
      logger.error(chunk);
    }
    if (isSuite) {
      await rm(filePath, { recursive: true, force: true });
    }
  } catch (error) {
    logger.error(error);
    sendTestEvent({
      event: "journey/end",
      data: {
        error,
      },
    });
  } finally {
    if (synthCliProcess) {
      synthCliProcess.kill();
    }
  }
};
