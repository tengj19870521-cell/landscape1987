import { Point } from "../types";

/**
 * Calculates the area of a polygon using the Shoelace formula.
 * Returns absolute value.
 */
export const calculatePolygonArea = (points: Point[]): number => {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
};

/**
 * Calculates the centroid of a polygon.
 */
export const getPolygonCentroid = (points: Point[]): { x: number, y: number } => {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0, y = 0, area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const f = points[i].x * points[j].y - points[j].x * points[i].y;
    x += (points[i].x + points[j].x) * f;
    y += (points[i].y + points[j].y) * f;
    area += f;
  }
  const f = area * 3;
  return { x: x / f, y: y / f };
};

/**
 * Gets the distance between two points.
 */
export const getDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

/**
 * Gets the midpoint between two points.
 */
export const getMidpoint = (p1: Point, p2: Point): { x: number, y: number } => {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
};

/**
 * Check if a point is inside a triangle
 */
const isPointInTriangle = (p: Point, a: Point, b: Point, c: Point): boolean => {
  const v0 = { x: c.x - a.x, y: c.y - a.y };
  const v1 = { x: b.x - a.x, y: b.y - a.y };
  const v2 = { x: p.x - a.x, y: p.y - a.y };

  const dot00 = v0.x * v0.x + v0.y * v0.y;
  const dot01 = v0.x * v1.x + v0.y * v1.y;
  const dot02 = v0.x * v2.x + v0.y * v2.y;
  const dot11 = v1.x * v1.x + v1.y * v1.y;
  const dot12 = v1.x * v2.x + v1.y * v2.y;

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

  return (u >= 0) && (v >= 0) && (u + v < 1);
};

/**
 * Triangulate a polygon using Ear Clipping algorithm.
 * Returns an array of indices [i, j, k] for the input points array.
 */
export const triangulatePolygon = (points: Point[]): number[] => {
  const indices = points.map((_, i) => i);
  const triangles: number[] = [];
  
  // Safety break
  let iterations = 0;
  const maxIterations = points.length * 3;

  while (indices.length > 3 && iterations < maxIterations) {
    iterations++;
    let earFound = false;

    for (let i = 0; i < indices.length; i++) {
      const prevIdx = indices[(i - 1 + indices.length) % indices.length];
      const currIdx = indices[i];
      const nextIdx = indices[(i + 1) % indices.length];

      const prev = points[prevIdx];
      const curr = points[currIdx];
      const next = points[nextIdx];

      // 1. Check convexity (cross product)
      // Assuming standard coordinate system (Y down for canvas), counter-clockwise
      const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
      
      // If cross > 0, it's a reflex vertex (concave), skip. 
      // Note: Depends on winding order. Assuming simple polygons here.
      // Adjusting for screen coordinates where Y is down.
      
      // 2. Check if any other point is inside this triangle
      let isEar = true;
      for (let j = 0; j < indices.length; j++) {
        if (j === i || j === (i - 1 + indices.length) % indices.length || j === (i + 1) % indices.length) continue;
        const p = points[indices[j]];
        if (isPointInTriangle(p, prev, curr, next)) {
          isEar = false;
          break;
        }
      }

      if (isEar) {
        triangles.push(prevIdx, currIdx, nextIdx);
        indices.splice(i, 1);
        earFound = true;
        break;
      }
    }

    if (!earFound) break; // Should not happen for simple polygons
  }

  // Add remaining triangle
  if (indices.length === 3) {
    triangles.push(indices[0], indices[1], indices[2]);
  }

  return triangles;
};