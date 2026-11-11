export type WorkerStatus = 'paused' | 'resuming' | 'retrying';

export interface WorkerLifecycle {
  document: EventTarget;
  window: EventTarget;
  hidden: () => boolean;
}

/** Keeps a pending request through suspension, with one retry for worker failures.
 * Completed results belong to the caller and are never replayed on activation.
 */
export class RecoverableWorker {
  onmessage?: (event: MessageEvent) => void;
  onerror?: (message: string) => void;
  private worker?: Worker;
  private request?: { data: unknown };
  private retries = 0;
  private paused = false;
  private startupTimer?: ReturnType<typeof setTimeout>;
  private epoch = 0;
  private readonly lifecycle?: WorkerLifecycle;

  constructor(
    private readonly createWorker: () => Worker,
    private readonly status: (status: WorkerStatus) => void = () => {},
    lifecycle = typeof document === 'undefined'
      ? undefined
      : { document, window, hidden: () => document.hidden },
    private readonly startupTimeout = 15000,
  ) {
    this.lifecycle = lifecycle;
  }

  postMessage(data: unknown) {
    this.terminate();
    this.request = { data };
    this.retries = 0;
    this.listen(true);
    if (this.lifecycle?.hidden()) this.pause();
    else this.start();
  }

  terminate() {
    this.stopAttempt();
    this.request = undefined;
    this.paused = false;
    this.listen(false);
  }

  private stopAttempt() {
    this.epoch++;
    clearTimeout(this.startupTimer);
    this.worker?.terminate();
    this.worker = undefined;
  }

  private start() {
    if (!this.request) return;
    const epoch = this.epoch;
    try {
      const worker = this.createWorker();
      this.worker = worker;
      worker.onmessage = (event) => {
        if (epoch !== this.epoch) return;
        clearTimeout(this.startupTimer);
        if (event.data?.phase === 'started') return;
        if (event.data?.phase !== 'compact') this.terminate();
        this.onmessage?.(event);
      };
      worker.onerror = (event) => {
        event?.preventDefault();
        if (epoch === this.epoch) this.fail('Unable to run the background worker. Try again.');
      };
      worker.onmessageerror = () => {
        if (epoch === this.epoch)
          this.fail('Unable to read the background worker result. Try again.');
      };
      // Only watch startup. A running optimization may legitimately take much longer.
      this.startupTimer = setTimeout(() => {
        if (epoch === this.epoch) this.fail('The background worker did not start. Try again.');
      }, this.startupTimeout);
      worker.postMessage(this.request.data);
    } catch {
      this.fail('Unable to start the background worker. Try again.');
    }
  }

  private fail(message: string) {
    if (!this.request) return;
    if (this.retries++ === 0) {
      if (this.lifecycle?.hidden()) {
        this.pause();
        return;
      }
      this.stopAttempt();
      this.status('retrying');
      this.start();
      return;
    }
    this.terminate();
    this.onerror?.(message);
  }

  private pause = () => {
    if (!this.request || this.paused) return;
    this.paused = true;
    this.stopAttempt();
    this.status('paused');
  };

  private resume = () => {
    if (!this.request || !this.paused || this.lifecycle?.hidden()) return;
    this.paused = false;
    this.status('resuming');
    this.start();
  };

  private listen(enabled: boolean) {
    if (!this.lifecycle) return;
    const method = enabled ? 'addEventListener' : 'removeEventListener';
    this.lifecycle.document[method]('visibilitychange', this.resume);
    this.lifecycle.document[method]('freeze', this.pause);
    this.lifecycle.document[method]('resume', this.resume);
    this.lifecycle.window[method]('pagehide', this.pause);
    this.lifecycle.window[method]('pageshow', this.resume);
  }
}
