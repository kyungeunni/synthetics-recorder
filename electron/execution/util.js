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
const { dialog, shell, BrowserWindow } = require("electron");
const logger = require("electron-log");
const { writeFile } = require("fs/promises");
const {
  SyntheticsGenerator,
} = require("@elastic/synthetics/dist/formatter/javascript");

exports.onTransformCode = async function onTransformCode(data) {
  const generator = new SyntheticsGenerator(data.isSuite);
  const code = generator.generateText(data.actions);
  return code;
};

exports.onLinkExternal = async function onLinkExternal(url) {
  try {
    await shell.openExternal(url);
  } catch (e) {
    logger.error(e);
  }
};

exports.onFileSave = async function onFileSave(code) {
  const { filePath, canceled } = await dialog.showSaveDialog(
    BrowserWindow.getFocusedWindow(),
    {
      defaultPath: "recorded.journey.js",
    }
  );

  if (!canceled) {
    await writeFile(filePath, code);
    return true;
  }
  return false;
};
