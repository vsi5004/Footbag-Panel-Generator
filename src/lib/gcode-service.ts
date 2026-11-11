import type { GcodeJobResult } from './gcode-runner';
import type { JobSnapshot } from './gcode-job';
import { RecoverableWorker, type WorkerStatus } from './recoverable-worker';
import { createGcodeWorker } from './worker-factory';

/** One worker per job makes cancellation immediate, even during synchronous CAM
 * work. Superseded workers cannot publish into a newer request's handlers.
 */
export class GcodeService {
  private pending?: { worker: RecoverableWorker; reject: (error: Error) => void };
  constructor(private createWorker = createGcodeWorker) {}
  cancel() {
    if (!this.pending) return;
    this.pending.worker.terminate();
    this.pending.reject(new DOMException('Generation cancelled', 'AbortError'));
    this.pending = undefined;
  }
  generate(
    snapshot: JobSnapshot,
    status?: (status: WorkerStatus) => void,
  ): Promise<GcodeJobResult> {
    this.cancel();
    return new Promise((resolve, reject) => {
      const worker = new RecoverableWorker(this.createWorker, status);
      const pending = { worker, reject };
      this.pending = pending;
      const finish = () => {
        worker.terminate();
        if (this.pending === pending) this.pending = undefined;
      };
      worker.onmessage = (event: MessageEvent<{ result?: GcodeJobResult; error?: string }>) => {
        if (this.pending !== pending) return;
        finish();
        if (event.data.result) resolve(event.data.result);
        else reject(new Error(event.data.error || 'Unable to generate GCode'));
      };
      worker.onerror = (message) => {
        if (this.pending !== pending) return;
        finish();
        reject(new Error(message));
      };
      try {
        worker.postMessage(snapshot);
      } catch (error) {
        finish();
        reject(error);
      }
    });
  }
}
