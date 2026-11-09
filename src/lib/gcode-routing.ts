import type { GcodeSettings } from './gcode-settings';
import type { Point } from '../types';
import type { CutPath } from './gcode-types';

interface Entry {
  path: number;
  start: number;
  point: Point;
}
interface Node {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  live: number;
  parent?: Node;
  left?: Node;
  right?: Node;
  entries?: Entry[];
}

/** Mutable spatial index of cut entry points. Completed/blocked paths can be
 * disabled without repeatedly scanning every stitch in large (144-panel) sheets.
 */
export class CutIndex {
  private root: Node;
  private leaves = new Map<number, Set<Node>>();
  private active: boolean[];
  constructor(paths: CutPath[], active: boolean[]) {
    this.active = active.slice();
    const entries: Entry[] = [];
    paths.forEach((p, path) => {
      for (let start = 0; start < p.points.length; start++)
        if (p.closed || start === 0 || start === p.points.length - 1)
          entries.push({ path, start, point: p.points[start] });
    });
    const build = (start: number, end: number, depth: number, parent?: Node): Node => {
      const node: Node = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
        live: 0,
        parent,
      };
      if (end - start <= 16) {
        for (let i = start; i < end; i++) {
          const e = entries[i];
          node.minX = Math.min(node.minX, e.point.x);
          node.maxX = Math.max(node.maxX, e.point.x);
          node.minY = Math.min(node.minY, e.point.y);
          node.maxY = Math.max(node.maxY, e.point.y);
        }
        node.entries = entries.slice(start, end);
        for (const e of node.entries) {
          if (active[e.path]) node.live++;
          const leaves = this.leaves.get(e.path) ?? new Set<Node>();
          leaves.add(node);
          this.leaves.set(e.path, leaves);
        }
      } else {
        const axis = depth % 2 ? 'y' : 'x';
        const middle = (start + end) >>> 1;
        selectMedian(entries, start, end, middle, axis);
        node.left = build(start, middle, depth + 1, node);
        node.right = build(middle, end, depth + 1, node);
        node.live = node.left.live + node.right.live;
        node.minX = Math.min(node.left.minX, node.right.minX);
        node.minY = Math.min(node.left.minY, node.right.minY);
        node.maxX = Math.max(node.left.maxX, node.right.maxX);
        node.maxY = Math.max(node.left.maxY, node.right.maxY);
      }
      return node;
    };
    this.root = build(0, entries.length, 0);
  }
  enable(path: number, enabled: boolean) {
    if (this.active[path] === enabled) return;
    this.active[path] = enabled;
    for (const leaf of this.leaves.get(path) ?? []) {
      let count = 0;
      for (const entry of leaf.entries!) if (entry.path === path) count++;
      const delta = count * (enabled ? 1 : -1);
      let node: Node | undefined = leaf;
      while (node) {
        node.live += delta;
        node = node.parent;
      }
    }
  }
  nearest(point: Point, eligible: (path: number) => boolean): Entry | undefined {
    let best: Entry | undefined,
      distance = Infinity;
    const lower = (n: Node) =>
      Math.max(0, n.minX - point.x, point.x - n.maxX) ** 2 +
      Math.max(0, n.minY - point.y, point.y - n.maxY) ** 2;
    const visit = (n: Node) => {
      if (!n.live || lower(n) > distance) return;
      if (n.entries)
        for (const e of n.entries) {
          if (!this.active[e.path] || !eligible(e.path)) continue;
          const d = (point.x - e.point.x) ** 2 + (point.y - e.point.y) ** 2;
          if (
            d < distance ||
            (d === distance &&
              best &&
              (e.path < best.path || (e.path === best.path && e.start < best.start)))
          ) {
            distance = d;
            best = e;
          }
        }
      else {
        const a = n.left!,
          b = n.right!;
        if (lower(a) <= lower(b)) {
          visit(a);
          visit(b);
        } else {
          visit(b);
          visit(a);
        }
      }
    };
    visit(this.root);
    return best;
  }
}

/** Deterministic nearest eligible cut; closed contours rotate entry, slits may reverse.
 * Nearest-start selection and Clipper offsets follow common CAM techniques;
 * see OpenBuilds CAM's toolpath worker. No CAM source is copied.
 * The selected policy controls whether unfinished stitches block panel release.
 */
export function orderCuts(paths: CutPath[], order: GcodeSettings['cutOrder']): CutPath[] {
  const remaining = new Map<number, number>();
  for (const p of paths)
    if (p.kind === 'stitch') remaining.set(p.panel, (remaining.get(p.panel) ?? 0) + 1);
  const result: CutPath[] = [];
  let cursor: Point = { x: 0, y: 0 },
    stitches = paths.filter((p) => p.kind === 'stitch').length;
  let activePanel: number | undefined;
  const panels = new Map<number, number>();
  paths.forEach((p, i) => {
    if (p.kind === 'panel') panels.set(p.panel, i);
  });
  const index = new CutIndex(
    paths,
    paths.map(
      (p) =>
        order === 'optimized' ||
        p.kind === 'stitch' ||
        (order === 'panel-by-panel' ? !remaining.get(p.panel) : !stitches),
    ),
  );
  while (result.length < paths.length) {
    const best = index.nearest(
      cursor,
      (i) =>
        order !== 'panel-by-panel' || activePanel === undefined || paths[i].panel === activePanel,
    );
    if (!best) throw new Error('Unable to order cutting paths');
    const selected = paths[best.path],
      start = best.start;
    index.enable(best.path, false);
    if (order === 'panel-by-panel')
      activePanel = selected.kind === 'panel' ? undefined : selected.panel;
    const points = selected.closed
      ? [...selected.points.slice(start), ...selected.points.slice(0, start)]
      : start
        ? selected.points.slice().reverse()
        : selected.points;
    result.push({ ...selected, points });
    cursor = points[selected.closed ? 0 : points.length - 1];
    if (selected.kind === 'stitch') {
      stitches--;
      remaining.set(selected.panel, remaining.get(selected.panel)! - 1);
      if (order === 'all-stitches-first' && !stitches)
        for (const i of panels.values()) index.enable(i, true);
      if (order === 'panel-by-panel' && !remaining.get(selected.panel))
        index.enable(panels.get(selected.panel)!, true);
    }
  }
  return result;
}

/** In-place three-way quickselect avoids sorting and copying every recursive range.
 * Equal coordinates form one partition, including fully coincident entry points.
 * Nearest-query tie breaking remains by original path/start, independent of tree order.
 */
function selectMedian(
  entries: Entry[],
  start: number,
  end: number,
  middle: number,
  axis: 'x' | 'y',
) {
  while (end - start > 1) {
    const a = entries[start].point[axis],
      b = entries[(start + end) >>> 1].point[axis],
      c = entries[end - 1].point[axis];
    const pivot = Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
    let lower = start,
      scan = start,
      upper = end;
    while (scan < upper) {
      const value = entries[scan].point[axis];
      if (value < pivot) {
        [entries[lower], entries[scan]] = [entries[scan], entries[lower]];
        lower++;
        scan++;
      } else if (value > pivot) {
        upper--;
        [entries[scan], entries[upper]] = [entries[upper], entries[scan]];
      } else scan++;
    }
    if (middle < lower) end = lower;
    else if (middle >= upper) start = upper;
    else return;
  }
}
