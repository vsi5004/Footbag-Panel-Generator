/** Coalesce work into one frame; synchronous consumers can flush the latest state. */
export function createFrameScheduler(
  task: () => void,
  request: (callback: FrameRequestCallback) => number = (callback) =>
    requestAnimationFrame(callback),
  cancel: (handle: number) => void = (handle) => cancelAnimationFrame(handle),
) {
  let pending: number | undefined;
  const flush = () => {
    if (pending === undefined) return;
    cancel(pending);
    pending = undefined;
    task();
  };
  return {
    schedule() {
      if (pending !== undefined) return;
      pending = request(() => {
        pending = undefined;
        task();
      });
    },
    flush,
    cancel() {
      if (pending !== undefined) cancel(pending);
      pending = undefined;
    },
  };
}
