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

import { useCallback, useState } from 'react';
import { RecordingStatus, Setter } from '../common/types';
import { IElectronAPI, ImportScriptListener, RecorderSteps } from '../../common/types';
import { IRecordingContext } from '../contexts/RecordingContext';

/**
 * Initializes recording state and defines handler functions to manipulate recording.
 *
 * @param ipc client to communicate with backend.
 * @param url starting URL for recordings.
 * @param stepCount current number of steps.
 * @returns state/functions to manage recording.
 */
export function useRecordingContext(
  electronAPI: IElectronAPI,
  url: string,
  stepCount: number,
  setResult: (data: undefined) => void,
  setSteps: Setter<RecorderSteps>
): IRecordingContext {
  const [isStartOverModalVisible, setIsStartOverModalVisible] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState(RecordingStatus.NotRecording);
  const toggleRecording = useCallback(async () => {
    if (recordingStatus === RecordingStatus.NotRecording && stepCount > 0) {
      setIsStartOverModalVisible(true);
    } else if (recordingStatus === RecordingStatus.Recording) {
      setRecordingStatus(RecordingStatus.NotRecording);
      // Stop browser process
      electronAPI.stopRecording();
    } else {
      setRecordingStatus(RecordingStatus.Recording);
      await electronAPI.recordJourney(url);
      setRecordingStatus(RecordingStatus.NotRecording);
    }
  }, [electronAPI, recordingStatus, stepCount, url]);

  const startOver = useCallback(async () => {
    setSteps([]);
    if (recordingStatus === RecordingStatus.NotRecording) {
      setRecordingStatus(RecordingStatus.Recording);
      // Depends on the result's context, because when we overwrite
      // a previous journey we need to discard its result status
      setResult(undefined);
      await electronAPI.recordJourney(url);
      setRecordingStatus(RecordingStatus.NotRecording);
    }
  }, [electronAPI, recordingStatus, setResult, setSteps, url]);

  const togglePause = async () => {
    if (recordingStatus === RecordingStatus.NotRecording) return;
    if (recordingStatus !== RecordingStatus.Paused) {
      setRecordingStatus(RecordingStatus.Paused);
      await electronAPI.pauseRecording();
    } else {
      await electronAPI.resumeRecording();
      setRecordingStatus(RecordingStatus.Recording);
    }
  };

  const importListener: ImportScriptListener = (_event, json) => {
    if (stepCount > 0) {
      // eslint-disable-next-line
      const yes = confirm('Current script will be lost, are you sure?');
      if (!yes) {
        return;
      }
    }
    // todo: validate schema
    setSteps(json.steps);
    setResult(undefined);
  };

  return {
    startOver,
    isStartOverModalVisible,
    setIsStartOverModalVisible,
    recordingStatus,
    toggleRecording,
    togglePause,
    importListener,
  };
}
