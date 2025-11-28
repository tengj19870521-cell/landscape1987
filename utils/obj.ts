import { Point, Zone, ZoneType, Road, ElevationPoint } from "../types";
import { triangulatePolygon } from "./geometry";

/**
 * Generates a Wavefront .OBJ 3D model file content.
 */
export const generateOBJ = (
  boundary: Point[],
  zones: Zone[],
  roads: Road[],
  elevations: ElevationPoint[],
  canvasHeight: number,
  pixelToMeterScale: number
): string => {
  
  let obj = "# LandscapeGenie Pro 3D Export\n";
  obj += `mtllib landscape.mtl\n`; // Placeholder for materials
  obj += `o SiteModel\n`;

  // Global Vertex Counter (OBJ is 1-based)
  let vCount = 1; 

  // --- Helper to convert 2D canvas point to 3D world point ---
  // Flip Y because Canvas Y is down, 3D Y is up (or Z is up)
  // Let's use Z-up for Architecture (X=East, Y=North, Z=Up)
  const to3D = (p: Point, z: number = 0) => {
    return {
      x: p.x * pixelToMeterScale,
      y: (canvasHeight - p.y) * pixelToMeterScale,
      z: z
    };
  };

  // --- 1. SITE BASE (Ground Plane) ---
  obj += "g Site_Ground\n";
  obj += "usemtl Material_Grass\n";
  
  // Add vertices for boundary
  boundary.forEach(p => {
    const v = to3D(p, 0); // Base at 0
    obj += `v ${v.x.toFixed(3)} ${v.y.toFixed(3)} ${v.z.toFixed(3)}\n`;
  });

  // Triangulate
  const baseTris = triangulatePolygon(boundary);
  for (let i = 0; i < baseTris.length; i += 3) {
    // Note: vCount is the offset for the current object's vertices
    obj += `f ${vCount + baseTris[i]} ${vCount + baseTris[i+1]} ${vCount + baseTris[i+2]}\n`;
  }
  vCount += boundary.length;


  // --- 2. ZONES (Extruded Buildings & Flat Areas) ---
  zones.forEach((zone, idx) => {
    if (zone.points.length < 3) return;

    const isBuilding = zone.type === ZoneType.STRUCTURE;
    const isWater = zone.type === ZoneType.WATER;
    const isPaving = zone.type === ZoneType.PAVING;
    
    // Settings
    const baseHeight = 0.05; // Slightly above ground to avoid Z-fighting
    const extrudeHeight = isBuilding ? 6.0 : 0.0; // 6m for buildings
    const zBase = isWater ? -0.5 : baseHeight; // Water is sunken
    const zTop = zBase + extrudeHeight;

    const groupName = isBuilding ? `Building_${idx}` : `Zone_${idx}_${zone.type.split(' ')[0]}`;
    obj += `g ${groupName}\n`;
    
    // Add Vertices (Bottom Ring & Top Ring if extruded)
    // Bottom Ring (or Single Surface)
    zone.points.forEach(p => {
        const v = to3D(p, zBase);
        obj += `v ${v.x.toFixed(3)} ${v.y.toFixed(3)} ${v.z.toFixed(3)}\n`;
    });
    
    const startIndex = vCount;
    vCount += zone.points.length;

    // Top Ring (Only for buildings)
    if (isBuilding) {
       zone.points.forEach(p => {
          const v = to3D(p, zTop);
          obj += `v ${v.x.toFixed(3)} ${v.y.toFixed(3)} ${v.z.toFixed(3)}\n`;
       });
       vCount += zone.points.length;
    }

    // FACES
    const zoneTris = triangulatePolygon(zone.points);

    // 1. Top/Bottom Surface
    if (isBuilding) {
        // Roof
        for (let i = 0; i < zoneTris.length; i += 3) {
            obj += `f ${startIndex + zone.points.length + zoneTris[i]} ${startIndex + zone.points.length + zoneTris[i+1]} ${startIndex + zone.points.length + zoneTris[i+2]}\n`;
        }
    } else {
        // Flat Surface
        for (let i = 0; i < zoneTris.length; i += 3) {
            obj += `f ${startIndex + zoneTris[i]} ${startIndex + zoneTris[i+1]} ${startIndex + zoneTris[i+2]}\n`;
        }
    }

    // 2. Walls (if extruded)
    if (isBuilding) {
        const len = zone.points.length;
        for (let i = 0; i < len; i++) {
            const next = (i + 1) % len;
            
            const b1 = startIndex + i;
            const b2 = startIndex + next;
            const t1 = startIndex + len + i;
            const t2 = startIndex + len + next;

            // Quad face (2 triangles)
            obj += `f ${b1} ${b2} ${t2}\n`;
            obj += `f ${b1} ${t2} ${t1}\n`;
        }
    }
  });


  // --- 3. ROADS ---
  obj += "g Roads\n";
  roads.forEach((road, idx) => {
      if (road.points.length < 2) return;
      // Convert line to a thin strip for 3D? Or just export lines.
      // OBJ supports lines using 'l'.
      road.points.forEach(p => {
         const v = to3D(p, 0.08); // Slightly higher than zones
         obj += `v ${v.x.toFixed(3)} ${v.y.toFixed(3)} ${v.z.toFixed(3)}\n`;
      });
      
      obj += "l";
      for(let i=0; i<road.points.length; i++) {
          obj += ` ${vCount + i}`;
      }
      obj += "\n";
      vCount += road.points.length;
  });

  // --- 4. ELEVATION MARKERS (Simple Pyramids) ---
  obj += "g Elevations\n";
  elevations.forEach(ep => {
      const p = to3D(ep, ep.value); // The exact point
      const size = 0.5;
      
      // Pyramid tip
      obj += `v ${p.x.toFixed(3)} ${p.y.toFixed(3)} ${p.z.toFixed(3)}\n`;
      // Base
      obj += `v ${(p.x-size).toFixed(3)} ${(p.y-size).toFixed(3)} ${(p.z-size).toFixed(3)}\n`;
      obj += `v ${(p.x+size).toFixed(3)} ${(p.y-size).toFixed(3)} ${(p.z-size).toFixed(3)}\n`;
      obj += `v ${(p.x+size).toFixed(3)} ${(p.y+size).toFixed(3)} ${(p.z-size).toFixed(3)}\n`;
      obj += `v ${(p.x-size).toFixed(3)} ${(p.y+size).toFixed(3)} ${(p.z-size).toFixed(3)}\n`;

      const t = vCount;
      // Faces
      obj += `f ${t} ${t+1} ${t+2}\n`;
      obj += `f ${t} ${t+2} ${t+3}\n`;
      obj += `f ${t} ${t+3} ${t+4}\n`;
      obj += `f ${t} ${t+4} ${t+1}\n`;
      
      vCount += 5;
  });

  return obj;
};