import type { EdgeSample, Point } from '../types';
import { geometry } from './geometry';

// Shared by constraint validation and stitch placement. Entries are read-only,
// bounded, and keyed by every input that affects sampling.
interface EdgeMetrics {
  samples: readonly EdgeSample[];
  distances: readonly number[];
  length: number;
}
const cache = new Map<string, EdgeMetrics>();
export function getEdgeMetrics(a: Point, b: Point, radius: number, count: number): EdgeMetrics {
  const key = [a.x, a.y, b.x, b.y, radius, count].join(',');
  const existing = cache.get(key);
  if (existing) return existing;
  const samples = geometry.approxArcEdgeSamples(a, b, radius, count);
  const distances = [0];
  let length = 0;
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1].p;
    const current = samples[i].p;
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
    distances.push(length);
  }
  const metrics = { samples, distances, length };
  if (cache.size >= 128) cache.delete(cache.keys().next().value!);
  cache.set(key, metrics);
  return metrics;
}
