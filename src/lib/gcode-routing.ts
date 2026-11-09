import type { Point } from '../types';
import type { CutPath } from './gcode';

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
    const entries = paths.flatMap((p, path) =>
      p.points.flatMap((point, start) =>
        p.closed || start === 0 || start === p.points.length - 1 ? [{ path, start, point }] : [],
      ),
    );
    const build = (list: Entry[], depth: number, parent?: Node): Node => {
      const node: Node = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
        live: 0,
        parent,
      };
      for (const e of list) {
        node.minX = Math.min(node.minX, e.point.x);
        node.maxX = Math.max(node.maxX, e.point.x);
        node.minY = Math.min(node.minY, e.point.y);
        node.maxY = Math.max(node.maxY, e.point.y);
      }
      if (list.length <= 16) {
        node.entries = list;
        for (const e of list) {
          if (active[e.path]) node.live++;
          const leaves = this.leaves.get(e.path) ?? new Set<Node>();
          leaves.add(node);
          this.leaves.set(e.path, leaves);
        }
      } else {
        const axis = depth % 2 ? 'y' : 'x';
        list.sort((a, b) => a.point[axis] - b.point[axis]);
        const middle = Math.floor(list.length / 2);
        node.left = build(list.slice(0, middle), depth + 1, node);
        node.right = build(list.slice(middle), depth + 1, node);
        node.live = node.left.live + node.right.live;
      }
      return node;
    };
    this.root = build(entries, 0);
  }
  enable(path: number, enabled: boolean) {
    if (this.active[path] === enabled) return;
    this.active[path] = enabled;
    for (const leaf of this.leaves.get(path) ?? []) {
      const delta = leaf.entries!.filter((e) => e.path === path).length * (enabled ? 1 : -1);
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
