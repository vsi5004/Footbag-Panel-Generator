/** Search separated safe intervals as well as the outer collision boundary.
 * Sampling is bounded; this is a heuristic, not a proof of the minimum pitch. */
export function minimumSafePitch(
  limit: number,
  safe: (pitch: number) => boolean,
  scan = true,
): number {
  let low = 0,
    high = limit;
  for (let i = 0; i < 9; i++) {
    const mid = (low + high) / 2;
    if (safe(mid)) high = mid;
    else low = mid;
  }
  if (!scan) return high;
  // Binary search alone can jump across an entire disconnected safe interval.
  const ceiling = high;
  let previous = 0;
  for (let i = 0; i <= 32; i++) {
    const pitch = (ceiling * i) / 32;
    if (safe(pitch)) {
      low = previous;
      high = pitch;
      for (let step = 0; step < 9; step++) {
        const mid = (low + high) / 2;
        if (safe(mid)) high = mid;
        else low = mid;
      }
      return high;
    }
    previous = pitch;
  }
  return limit; // Caller still validates the complete candidate.
}
