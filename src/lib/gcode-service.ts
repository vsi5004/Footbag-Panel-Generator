import type { GcodeJobResult } from './gcode-runner';
import type { JobSnapshot } from './gcode-job';

/** One worker per job makes cancellation immediate, even during synchronous CAM
 * work. Superseded workers cannot publish into a newer request's handlers.
 */
export class GcodeService {
  private pending?: { worker: Worker; reject: (error: Error) => void };
  constructor(
    private createWorker = () =>
      new Worker(new URL('./gcode-worker.ts', import.meta.url), { type: 'module' }),
  ) {}
  cancel() {
    if (!this.pending) return;
    this.pending.worker.terminate();
    this.pending.reject(new DOMException('Generation cancelled', 'AbortError'));
    this.pending = undefined;
  }
  generate(snapshot: JobSnapshot): Promise<GcodeJobResult> {
    this.cancel();
    return new Promise((resolve, reject) => {
      const worker = this.createWorker();
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
      worker.onerror = () => {
        if (this.pending !== pending) return;
        finish();
        reject(new Error('Unable to start GCode worker. Try generating again.'));
      };
      worker.onmessageerror = () => {
        if (this.pending !== pending) return;
        finish();
        reject(new Error('Unable to read GCode worker result. Try generating again.'));
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
