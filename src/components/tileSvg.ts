import type { Direction } from '../game';

/** Midpoint of each cell side. */
export function directionToPoint(dir: Direction): { x: number; y: number } {
  switch (dir) {
    case 'up':    return { x: 50, y: 0 };
    case 'down':  return { x: 50, y: 100 };
    case 'left':  return { x: 0, y: 50 };
    case 'right': return { x: 100, y: 50 };
  }
}

/**
 * SVG path `d` attribute for a quarter-circle arc connecting two
 * adjacent cell sides. The arc curves inward through the cell interior
 * (standard Truchet tile shape).
 *
 * Radius = 50 (half the cell size), so the arc is a perfect quarter circle
 * centered at the shared corner.
 */
export function arcPathD(a: Direction, b: Direction): string {
  const pa = directionToPoint(a);
  const pb = directionToPoint(b);
  const sweep = arcSweepFlag(a, b);
  return `M ${pa.x} ${pa.y} A 50 50 0 0 ${sweep} ${pb.x} ${pb.y}`;
}

/**
 * Determines the SVG arc sweep-flag so the arc curves inward
 * (away from the corner, toward the cell center).
 */
function arcSweepFlag(a: Direction, b: Direction): number {
  const key = [a, b].sort().join(',');
  // Sorted pairs and their correct sweep flags for inward arcs:
  const flags: Record<string, number> = {
    'left,up':    1,  // top-left corner → arc curves toward center
    'right,up':   0,  // top-right corner
    'down,right': 1,  // bottom-right corner
    'down,left':  0,  // bottom-left corner
  };
  return flags[key] ?? 0;
}
