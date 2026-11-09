import { runGcodeJob } from './gcode-runner';
import type { JobSnapshot } from './gcode-job';
self.onmessage = (event: MessageEvent<JobSnapshot>) => {
  try {
    self.postMessage({ result: runGcodeJob(event.data) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Unable to generate GCode',
    });
  }
};
