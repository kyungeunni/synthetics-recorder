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
import { dialog, IpcMainInvokeEvent } from 'electron';
import path from 'path';
import { writeFile, readFile } from 'fs/promises';
import { getMainWindow } from '../util';
import { transformToSyntheticsJson, parseRecordingContent } from 'puppeteer-replay-to-synthetics';

export enum IMPORT_JSON_TYPE {
  SYNTHETICS = 'synthetics',
  CHROME_RECORDER = 'chrome-recorder',
}
export async function onExportScript(_event: IpcMainInvokeEvent, code: string, isJson: boolean) {
  const { filePath, canceled } = await dialog.showSaveDialog(getMainWindow(), {
    filters: [
      isJson
        ? {
            name: 'JSON',
            extensions: ['json'],
          }
        : {
            name: 'JavaScript',
            extensions: ['js'],
          },
    ],
    defaultPath: `recorded.journey${isJson ? '.json' : '.js'}`,
  });

  if (!canceled && filePath) {
    await writeFile(filePath, code);
    return true;
  }
  return false;
}

export async function importScript(type: IMPORT_JSON_TYPE) {
  const window = getMainWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (canceled == null) {
    return;
  }

  const [pathToFile] = filePaths;
  try {
    const contents = await readFile(pathToFile, { encoding: 'utf-8' });
    const parsed =
      type === IMPORT_JSON_TYPE.CHROME_RECORDER
        ? transformToSyntheticsJson(parseRecordingContent(contents))
        : JSON.parse(contents);

    // TODO: deliver parsed script to StepsContext.tsx :thinking-face:
    getMainWindow().webContents.send('import-script', parsed);
  } catch (err) {
    throw new Error(`Failed to import file ${path.basename(pathToFile || '')} (type: ${type})`);
  }
}
