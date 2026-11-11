import NestingWorker from './nesting-worker?worker&inline';
import GcodeWorker from './gcode-worker?worker&inline';

// Keep each tab's worker code with its app bundle, including after a deployment
// removes older hashed assets. Every job still gets an independent worker.
export const createNestingWorker = () => new NestingWorker();
export const createGcodeWorker = () => new GcodeWorker();
