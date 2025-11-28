import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Point, Road, Zone, ZoneType, ElevationPoint } from '../types';

interface ThreeSceneProps {
  boundary: Point[];
  roads: Road[];
  zones: Zone[];
  elevations: ElevationPoint[];
  width: number;
  height: number;
  pixelToMeterScale: number;
}

const ThreeScene: React.FC<ThreeSceneProps> = ({ boundary, roads, zones, elevations, width, height, pixelToMeterScale }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- 1. Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe0e7ff); // Soft blue-grey background
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.set(0, 60, 60); // High angle
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent going below ground

    // Lights
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    // Adjust shadow camera bounds
    const d = 100;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // --- 2. Build Geometry ---
    const centerX = width / 2;
    const centerY = height / 2;

    const to3D = (p: Point) => {
      return new THREE.Vector2(
        (p.x - centerX) * pixelToMeterScale,
        (p.y - centerY) * pixelToMeterScale
      );
    };

    // MATERIALS
    const materials = {
      ground: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.8 }),
      water: new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.9 }),
      greenery: new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 1.0 }),
      paving: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6 }),
      structure: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }),
      road: new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.9 }),
      base: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 }),
    };

    // GROUND (Boundary)
    if (boundary.length > 2) {
      const shape = new THREE.Shape();
      const start = to3D(boundary[0]);
      shape.moveTo(start.x, start.y);
      for (let i = 1; i < boundary.length; i++) {
        const p = to3D(boundary[i]);
        shape.lineTo(p.x, p.y);
      }
      const geom = new THREE.ShapeGeometry(shape);
      geom.rotateX(Math.PI / 2); 
      
      const mesh = new THREE.Mesh(geom, materials.ground);
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Add a thick base plinth for "Model" look
      const extrudeSettings = { depth: 2, bevelEnabled: false };
      const baseGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      baseGeom.rotateX(Math.PI / 2);
      baseGeom.translate(0, -2.01, 0); // Move down
      const baseMesh = new THREE.Mesh(baseGeom, materials.base);
      baseMesh.receiveShadow = true;
      scene.add(baseMesh);
    }

    // ZONES
    zones.forEach(zone => {
      if (zone.points.length < 3) return;
      
      // Simplify logic: Shape in 2D
      const shape = new THREE.Shape();
      const start = to3D(zone.points[0]);
      shape.moveTo(start.x, start.y);
      for (let i = 1; i < zone.points.length; i++) {
        const p = to3D(zone.points[i]);
        shape.lineTo(p.x, p.y);
      }

      let material = materials.paving;
      let extrude = 0.05;
      let yOffset = 0.02;

      if (zone.type === ZoneType.WATER) { material = materials.water; yOffset = 0.05; }
      else if (zone.type === ZoneType.GREENERY) { material = materials.greenery; extrude=0.1; yOffset = 0.02; }
      else if (zone.type === ZoneType.PAVING) { material = materials.paving; yOffset = 0.03; }
      else if (zone.type === ZoneType.STRUCTURE) { material = materials.structure; extrude = 6; yOffset = 0; }

      const geom = new THREE.ExtrudeGeometry(shape, { depth: extrude, bevelEnabled: false });
      geom.rotateX(Math.PI / 2);
      // Correct rotation: After rotateX(90), Z becomes -Y. 
      // We need to shift it up.
      
      const mesh = new THREE.Mesh(geom, material);
      mesh.position.y = yOffset;
      if (zone.type === ZoneType.STRUCTURE) mesh.position.y += extrude; // Pivot correction if needed
      // Actually standard rotation places it at Y=0 extending to -Y or +Y depending on winding.
      // Let's reset and do it cleanly:
      // Shape is XY. Extrude is Z.
      // We want XZ plane.
      // So we map Shape (x, y) -> (x, z). Height is y.
      
      // Let's rely on standard: rotateX(PI/2) maps XY plane to XZ plane.
      // Extrusion depth becomes Z (which is now -Y).
      // So if depth is 6, it goes from 0 down to -6.
      // So we lift it by 6 to sit on ground.
      mesh.position.y = yOffset + extrude;
      
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });

    // ROADS
    roads.forEach(road => {
       if (road.points.length < 2) return;
       // Create ribbon geometry for roads instead of lines
       const path = new THREE.CurvePath();
       // ... simplified to lines for robustness in this view
       const points = road.points.map(p => {
         const v2 = to3D(p);
         return new THREE.Vector3(v2.x, 0.08, v2.y);
       });
       const geom = new THREE.BufferGeometry().setFromPoints(points);
       const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0xff6b6b, linewidth: 2 }));
       scene.add(line);
       
       // Add small spheres at nodes
       points.forEach(p => {
         const dot = new THREE.Mesh(new THREE.SphereGeometry(0.3), materials.road);
         dot.position.copy(p);
         scene.add(dot);
       });
    });

    // ELEVATIONS
    elevations.forEach(ep => {
       const v2 = to3D(ep);
       const geom = new THREE.ConeGeometry(0.5, 1, 4);
       const mat = new THREE.MeshStandardMaterial({ color: 0x2563eb });
       const mesh = new THREE.Mesh(geom, mat);
       mesh.position.set(v2.x, ep.value, v2.y);
       scene.add(mesh);
       
       // Pole
       const lineGeom = new THREE.BufferGeometry().setFromPoints([
           new THREE.Vector3(v2.x, 0, v2.y),
           new THREE.Vector3(v2.x, ep.value, v2.y)
       ]);
       const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0x2563eb }));
       scene.add(line);
    });

    // Animation Loop
    let id: number;
    const animate = () => {
      id = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(id);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [boundary, roads, zones, elevations, width, height, pixelToMeterScale]);

  return <div ref={containerRef} className="w-full h-full bg-slate-50 cursor-move rounded-lg overflow-hidden border border-slate-200" />;
};

export default ThreeScene;