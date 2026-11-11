import test from 'node:test';
import assert from 'node:assert/strict';
import { RecoverableWorker } from '../src/lib/recoverable-worker.ts';

function harness(timeout = 15000) {
  const workers = [],
    statuses = [];
  let hidden = false;
  const lifecycle = {
    document: new EventTarget(),
    window: new EventTarget(),
    hidden: () => hidden,
  };
  const job = new RecoverableWorker(
    () => {
      const worker = {
        terminated: false,
        postMessage(data) {
          this.request = data;
        },
        terminate() {
          this.terminated = true;
        },
        complete(data) {
          this.onmessage?.({ data });
        },
      };
      workers.push(worker);
      return worker;
    },
    (status) => statuses.push(status),
    lifecycle,
    timeout,
  );
  return {
    job,
    workers,
    statuses,
    lifecycle,
    visibility(value) {
      hidden = value;
      lifecycle.document.dispatchEvent(new Event('visibilitychange'));
    },
  };
}

test('suspended requests resume with fresh workers and ignore late responses', () => {
  const h = harness(),
    replies = [],
    request = { panel: 'hexagon' };
  h.job.onmessage = (e) => replies.push(e.data);
  h.job.postMessage(request);
  h.workers[0].complete({ phase: 'started' });
  h.visibility(true);
  assert.equal(h.workers[0].terminated, false);
  h.lifecycle.document.dispatchEvent(new Event('freeze'));
  assert.equal(h.workers[0].terminated, true);
  h.workers[0].complete({ result: 'obsolete' });
  h.visibility(false);
  assert.deepEqual(h.workers[1].request, request);
  h.workers[1].complete({ phase: 'compact', count: 42 });
  h.workers[1].complete({ result: 'current' });
  assert.deepEqual(replies, [{ phase: 'compact', count: 42 }, { result: 'current' }]);
  assert.deepEqual(h.statuses, ['paused', 'resuming']);
  h.visibility(true);
  h.visibility(false);
  assert.equal(h.workers.length, 2);
});

test('a worker that fails in the background is recreated on return', () => {
  const h = harness();
  h.job.postMessage('pending');
  h.visibility(true);
  h.workers[0].onerror({ preventDefault() {} });
  assert.equal(h.workers[0].terminated, true);
  assert.equal(h.workers.length, 1);
  h.visibility(false);
  assert.equal(h.workers[1].request, 'pending');
  assert.deepEqual(h.statuses, ['paused', 'resuming']);
  h.job.terminate();
});

test('freeze/pageshow recovery is cancellable and keeps an initially hidden job queued', () => {
  const h = harness();
  h.visibility(true);
  h.job.postMessage('pending');
  assert.equal(h.workers.length, 0);
  h.visibility(false);
  h.lifecycle.document.dispatchEvent(new Event('freeze'));
  h.lifecycle.window.dispatchEvent(new Event('pageshow'));
  assert.equal(h.workers.length, 2);
  assert.equal(h.workers[0].terminated, true);
  h.job.terminate();
  h.lifecycle.document.dispatchEvent(new Event('resume'));
  assert.equal(h.workers.length, 2);
  assert.equal(h.workers[1].terminated, true);
});

test('infrastructure failures retry once, while job errors are returned directly', () => {
  const h = harness(),
    errors = [],
    replies = [];
  h.job.onerror = (message) => errors.push(message);
  h.job.onmessage = (e) => replies.push(e.data);
  h.job.postMessage('request');
  h.workers[0].onerror({ preventDefault() {} });
  assert.equal(h.workers[0].terminated, true);
  h.workers[1].onmessageerror();
  assert.equal(errors.length, 1);
  h.job.postMessage('retry');
  h.workers[2].complete({ error: 'Increase minimum cutting gap' });
  assert.deepEqual(replies, [{ error: 'Increase minimum cutting gap' }]);
  assert.equal(h.workers.length, 3);
});

test('startup timeout retries a silent worker without imposing a running-job deadline', async () => {
  const h = harness(15);
  h.job.postMessage('request');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(h.workers.length, 2);
  h.workers[1].complete({ phase: 'started' });
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(h.workers[1].terminated, false);
  h.job.terminate();
});

test('constructor failures are bounded and a later request can recover', () => {
  let attempts = 0;
  const errors = [];
  const job = new RecoverableWorker(() => {
    attempts++;
    throw new Error('unavailable');
  });
  job.onerror = (message) => errors.push(message);
  job.postMessage('request');
  assert.equal(attempts, 2);
  assert.equal(errors.length, 1);
  job.postMessage('retry');
  assert.equal(attempts, 4);
});
