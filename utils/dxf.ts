import { Point, ElevationPoint, Road, Zone, ZoneType } from "../types";
import { getDistance, getMidpoint, calculatePolygonArea, getPolygonCentroid } from "./geometry";

export const generateDXF = (
  boundary: Point[], 
  elevations: ElevationPoint[],
  roads: Road[],
  zones: Zone[],
  height: number, 
  pixelToMeterScale: number
): string => {
  // Helpers
  const formatFloat = (n: number) => n.toFixed(3);
  
  // Convert pixel point to CAD point (meters, Y-flipped)
  const toCad = (p: Point | {x: number, y: number}, z: number = 0) => ({
    x: p.x * pixelToMeterScale,
    y: (height - p.y) * pixelToMeterScale,
    z: z
  });

  let dxf = "";

  // 1. Header & Tables (Layers)
  dxf += [
    "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "6", "0", "ENDSEC", // Units: Meters
    "0", "SECTION", "2", "TABLES",
    "0", "TABLE", "2", "LAYER", "70", "8",
    // Layer: BOUNDARY
    "0", "LAYER", "2", "SITE_BOUNDARY", "70", "0", "62", "7", "6", "CONTINUOUS",
    // Layer: ROADS
    "0", "LAYER", "2", "ROADS_CENTERLINE", "70", "0", "62", "1", "6", "DASHDOT", // Red
    // Layer: ZONES
    "0", "LAYER", "2", "FUNCTION_ZONES", "70", "0", "62", "5", "6", "CONTINUOUS", // Blue
    // Layer: ELEVATIONS
    "0", "LAYER", "2", "ELEVATIONS", "70", "0", "62", "3", "6", "CONTINUOUS", // Green
    // Layer: DIMENSIONS
    "0", "LAYER", "2", "DIMENSIONS", "70", "0", "62", "8", "6", "CONTINUOUS", // Gray
    // Layer: ANNOTATIONS
    "0", "LAYER", "2", "ANNOTATIONS", "70", "0", "62", "4", "6", "CONTINUOUS", // Cyan
     // Layer: TEXT
    "0", "LAYER", "2", "TEXT", "70", "0", "62", "2", "6", "CONTINUOUS", // Yellow
    "0", "ENDTAB", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES"
  ].join("\n") + "\n";

  // 2. Boundary Polyline
  if (boundary.length > 0) {
    dxf += [
      "0", "LWPOLYLINE",
      "8", "SITE_BOUNDARY",
      "90", boundary.length.toString(),
      "70", "1", // Closed
      "38", "0.0"
    ].join("\n") + "\n";
    boundary.forEach(p => {
      const cadP = toCad(p);
      dxf += `10\n${formatFloat(cadP.x)}\n20\n${formatFloat(cadP.y)}\n`;
    });
  }

  // 3. Roads (Open Polylines)
  roads.forEach(road => {
    if (road.points.length < 2) return;
    dxf += [
      "0", "LWPOLYLINE",
      "8", "ROADS_CENTERLINE",
      "90", road.points.length.toString(),
      "70", "0", // Open
      "38", "0.0"
    ].join("\n") + "\n";
    road.points.forEach(p => {
      const cadP = toCad(p);
      dxf += `10\n${formatFloat(cadP.x)}\n20\n${formatFloat(cadP.y)}\n`;
    });
  });

  // 4. Zones (Closed Polygons)
  zones.forEach(zone => {
    if (zone.points.length < 3) return;
    dxf += [
      "0", "LWPOLYLINE",
      "8", "FUNCTION_ZONES",
      "90", zone.points.length.toString(),
      "70", "1", // Closed
      "38", "0.0"
    ].join("\n") + "\n";
    zone.points.forEach(p => {
      const cadP = toCad(p);
      dxf += `10\n${formatFloat(cadP.x)}\n20\n${formatFloat(cadP.y)}\n`;
    });

    // Zone Label
    const centroid = getPolygonCentroid(zone.points);
    const cadC = toCad(centroid);
    const label = zone.type.split(' ')[0]; // Get Chinese name
    dxf += [
      "0", "TEXT", "8", "TEXT",
      "10", formatFloat(cadC.x), "20", formatFloat(cadC.y),
      "40", formatFloat(0.8), "1", label,
      "72", "1", "11", formatFloat(cadC.x), "21", formatFloat(cadC.y)
    ].join("\n") + "\n";
  });

  // 5. Elevation Points
  elevations.forEach(ep => {
    const cadP = toCad(ep, ep.value);
    dxf += [
      "0", "POINT", "8", "ELEVATIONS",
      "10", formatFloat(cadP.x), "20", formatFloat(cadP.y), "30", formatFloat(cadP.z)
    ].join("\n") + "\n";

    dxf += [
      "0", "TEXT", "8", "TEXT",
      "10", formatFloat(cadP.x + 0.2), "20", formatFloat(cadP.y + 0.2), "30", formatFloat(cadP.z),
      "40", formatFloat(0.3), "1", `EL: +${ep.value.toFixed(2)}`, "50", "0"
    ].join("\n") + "\n";
  });

  // 6. Dimensions & Area (Only if boundary exists)
  if (boundary.length > 2) {
    const areaM2 = calculatePolygonArea(boundary) * Math.pow(pixelToMeterScale, 2);
    const centroid = getPolygonCentroid(boundary);
    const cadCentroid = toCad(centroid);

    dxf += [
      "0", "TEXT", "8", "ANNOTATIONS",
      "10", formatFloat(cadCentroid.x), "20", formatFloat(cadCentroid.y),
      "40", formatFloat(1.2), "1", `AREA: ${areaM2.toFixed(1)} m^2`,
      "72", "1", "11", formatFloat(cadCentroid.x), "21", formatFloat(cadCentroid.y)
    ].join("\n") + "\n";
  }

  // Footer
  dxf += "0\nENDSEC\n0\nEOF";

  return dxf;
};