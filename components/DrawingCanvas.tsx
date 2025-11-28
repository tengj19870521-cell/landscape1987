import React, { useRef, useEffect, useState } from 'react';
import { RefreshCcw, Move, Mountain, Waypoints, Square, MousePointer2, Image as ImageIcon, ToggleLeft, ToggleRight } from 'lucide-react';
import { Point, ElevationPoint, Road, Zone, ZoneType, AspectRatio } from '../types';
import { getPolygonCentroid } from '../utils/geometry';

interface DrawingCanvasProps {
  onImageUpdate: (imageData: string | null) => void;
  onDataUpdate: (boundary: Point[], roads: Road[], zones: Zone[], elevations: ElevationPoint[], width: number, height: number, pixelToMeterScale: number) => void;
  siteWidthMeters: number;
  aspectRatio: AspectRatio;
}

type ToolMode = 'BOUNDARY' | 'EDIT' | 'ROAD' | 'ZONE' | 'ELEVATION';

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onImageUpdate, onDataUpdate, siteWidthMeters, aspectRatio }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Data State
  const [boundary, setBoundary] = useState<Point[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [elevations, setElevations] = useState<ElevationPoint[]>([]);
  
  // Base Map State
  const [baseMapImage, setBaseMapImage] = useState<string | null>(null);
  const [includeBaseMap, setIncludeBaseMap] = useState(true);

  // Interaction State
  const [isClosed, setIsClosed] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingType, setDraggingType] = useState<'boundary' | 'road' | 'zone' | null>(null);
  const [draggingObjId, setDraggingObjId] = useState<string | null>(null); 
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState<ToolMode>('BOUNDARY');
  
  const [currentRoadPoints, setCurrentRoadPoints] = useState<Point[]>([]);
  const [currentZonePoints, setCurrentZonePoints] = useState<Point[]>([]);
  const [activeZoneType, setActiveZoneType] = useState<ZoneType>(ZoneType.GREENERY);

  const pixelToMeterScale = dimensions.width > 0 ? siteWidthMeters / dimensions.width : 0.1;

  // Calculate canvas size based on ratio
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        
        let targetW = containerWidth;
        let targetH = containerHeight;

        // Parse Aspect Ratio
        const [rw, rh] = aspectRatio.split(':').map(Number);
        const ratio = rw / rh;

        // Fit logic: contain within container
        if (containerWidth / containerHeight > ratio) {
            targetH = containerHeight;
            targetW = targetH * ratio;
        } else {
            targetW = containerWidth;
            targetH = targetW / ratio;
        }

        setDimensions({ width: targetW, height: targetH });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, [aspectRatio]);

  // Sync Data
  useEffect(() => {
    if (dimensions.width === 0) return;
    onDataUpdate(boundary, roads, zones, elevations, dimensions.width, dimensions.height, pixelToMeterScale);
    
    if ((isClosed && boundary.length > 2) || baseMapImage) {
      generateContextImage();
    } else {
      onImageUpdate(null);
    }
  }, [boundary, roads, zones, elevations, isClosed, dimensions, pixelToMeterScale, baseMapImage, includeBaseMap]);

  const generateContextImage = () => {
    const canvas = document.createElement('canvas');
    // High resolution export
    const scaleFactor = 2; 
    canvas.width = dimensions.width * scaleFactor;
    canvas.height = dimensions.height * scaleFactor;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(scaleFactor, scaleFactor);

    // 1. Background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // 2. Base Map
    if (baseMapImage && includeBaseMap) {
       const img = new Image();
       img.src = baseMapImage;
       if (img.complete) {
          ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(0, 0, dimensions.width, dimensions.height);
       }
    }

    // 3. Zones (Purple for Structures - Critical for AI)
    zones.forEach(zone => {
      if (zone.points.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(zone.points[0].x, zone.points[0].y);
      zone.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      
      if (zone.type === ZoneType.WATER) ctx.fillStyle = '#3b82f6';
      else if (zone.type === ZoneType.GREENERY) ctx.fillStyle = '#22c55e';
      else if (zone.type === ZoneType.PAVING) ctx.fillStyle = '#9ca3af';
      else if (zone.type === ZoneType.STRUCTURE) ctx.fillStyle = '#9333ea';
      
      ctx.globalAlpha = 0.85; 
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    // 4. Boundary
    if (boundary.length > 2) {
        ctx.beginPath();
        ctx.moveTo(boundary[0].x, boundary[0].y);
        boundary.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 6;
        ctx.stroke();
    }

    // 5. Roads (Red)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    roads.forEach(road => {
      if (road.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(road.points[0].x, road.points[0].y);
      road.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 10;
      ctx.setLineDash([]); 
      ctx.stroke();
    });
    
    if (baseMapImage && includeBaseMap) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => onImageUpdate(canvas.toDataURL('image/png'));
        img.src = baseMapImage;
        if (img.complete) onImageUpdate(canvas.toDataURL('image/png'));
    } else {
        onImageUpdate(canvas.toDataURL('image/png'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setBaseMapImage(evt.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSvgClick = (e: React.MouseEvent) => {
    // We need to account for the centered canvas within the container
    // The dimensions.width/height is the actual SVG size
    // The SVG is centered in containerRef
    // But e.clientX is relative to viewport
    // Easier: get Bounding Client Rect of the SVG element itself if possible, but we don't have ref directly on svg
    // Let's rely on native event target if it is the svg or child
    
    // Fallback: The svg is rendered with width/height in px. 
    // We can just use nativeEvent.offsetX / Y if target is svg
    // But child elements mess that up. 
    // Standard approach:
    const svgRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;

    const newPoint: Point = { x, y, id: Math.random().toString(36).substr(2, 9) };

    if (mode === 'BOUNDARY' && !isClosed) {
      setBoundary(prev => [...prev, newPoint]);
    } 
    else if (mode === 'ROAD') {
      setCurrentRoadPoints(prev => [...prev, newPoint]);
    }
    else if (mode === 'ZONE') {
      setCurrentZonePoints(prev => [...prev, newPoint]);
    }
    else if (mode === 'ELEVATION' && isClosed) {
      const valueStr = prompt("请输入标高 (米):", "0.0");
      const value = parseFloat(valueStr || "");
      if (!isNaN(value)) {
        setElevations(prev => [...prev, { ...newPoint, value }]);
      }
    }
  };

  const finishRoad = () => {
    if (currentRoadPoints.length > 1) {
      setRoads(prev => [...prev, { id: Math.random().toString(), points: currentRoadPoints, width: 2 }]);
    }
    setCurrentRoadPoints([]);
  };

  const finishZone = () => {
    if (currentZonePoints.length > 2) {
      setZones(prev => [...prev, { id: Math.random().toString(), points: currentZonePoints, type: activeZoneType }]);
    }
    setCurrentZonePoints([]);
  };

  const handlePointMouseDown = (e: React.MouseEvent, id: string, type: 'boundary' | 'road' | 'zone', objId?: string) => {
    e.stopPropagation();
    if (e.altKey || e.shiftKey) {
        if (type === 'road' && objId) setRoads(prev => prev.filter(r => r.id !== objId));
        else if (type === 'zone' && objId) setZones(prev => prev.filter(z => z.id !== objId));
        return;
    }
    if (type === 'boundary' && !isClosed && boundary.length >= 3 && id === boundary[0].id) {
      setIsClosed(true);
      setMode('EDIT');
      return;
    }
    if (mode === 'EDIT') {
      setDraggingId(id);
      setDraggingType(type);
      if (objId) setDraggingObjId(objId);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingId && mode === 'EDIT') {
      const svgRect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - svgRect.left;
      const y = e.clientY - svgRect.top;

      if (draggingType === 'boundary') {
        setBoundary(prev => prev.map(p => p.id === draggingId ? { ...p, x, y } : p));
      } 
      else if (draggingType === 'road' && draggingObjId) {
        setRoads(prev => prev.map(r => r.id === draggingObjId ? {
            ...r, points: r.points.map(p => p.id === draggingId ? { ...p, x, y } : p)
        } : r));
      }
      else if (draggingType === 'zone' && draggingObjId) {
        setZones(prev => prev.map(z => z.id === draggingObjId ? {
            ...z, points: z.points.map(p => p.id === draggingId ? { ...p, x, y } : p)
        } : z));
      }
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setDraggingType(null);
    setDraggingObjId(null);
  };

  const resetCanvas = () => {
    if (window.confirm("确定要清空画布吗？")) {
      setBoundary([]);
      setRoads([]);
      setZones([]);
      setElevations([]);
      setIsClosed(false);
      setMode('BOUNDARY');
      setBaseMapImage(null);
      onImageUpdate(null);
    }
  };

  const renderGrid = () => (
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth="1" />
    </pattern>
  );

  return (
    <div className="flex flex-row h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Left Toolbar */}
      <div className="w-14 flex flex-col items-center py-4 gap-4 bg-slate-50 border-r border-slate-200 z-10 overflow-y-auto no-scrollbar">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
        <ToolBtn active={!!baseMapImage} onClick={() => fileInputRef.current?.click()} icon={<ImageIcon size={18}/>} label="底图"/>
        <div className="w-8 h-[1px] bg-slate-200 my-1"></div>
        <ToolBtn active={mode === 'BOUNDARY' || mode === 'EDIT'} onClick={() => setMode(isClosed ? 'EDIT' : 'BOUNDARY')} icon={isClosed ? <MousePointer2 size={18}/> : <Square size={18}/>} label="边界"/>
        <ToolBtn active={mode === 'ROAD'} onClick={() => { setMode('ROAD'); setCurrentRoadPoints([]); setCurrentZonePoints([]); }} icon={<Waypoints size={18}/>} label="道路"/>
        <div className="relative group">
            <ToolBtn active={mode === 'ZONE'} onClick={() => { setMode('ZONE'); setCurrentRoadPoints([]); setCurrentZonePoints([]); }} icon={<Move size={18}/>} label="分区"/>
            <div className="hidden group-hover:flex absolute left-full top-0 ml-2 bg-white shadow-md rounded-md p-2 flex-col gap-1 w-32 border border-slate-100 z-50">
               {Object.values(ZoneType).map(t => (
                   <button key={t} onClick={(e) => { e.stopPropagation(); setMode('ZONE'); setActiveZoneType(t); }} className={`text-xs text-left px-2 py-1 rounded hover:bg-slate-100 ${activeZoneType === t ? 'text-brand-600 font-bold bg-brand-50' : 'text-slate-600'}`}>
                     {t.split(' ')[0]}
                   </button>
               ))}
            </div>
        </div>
        <ToolBtn active={mode === 'ELEVATION'} onClick={() => setMode('ELEVATION')} icon={<Mountain size={18}/>} label="标高"/>
        <div className="mt-auto flex flex-col gap-2">
            <ToolBtn active={false} onClick={resetCanvas} icon={<RefreshCcw size={16}/>} label="重置" color="text-red-500 hover:bg-red-50"/>
        </div>
      </div>
      
      {/* Canvas Container (Centered) */}
      <div ref={containerRef} className="relative flex-1 bg-slate-100 flex items-center justify-center p-4 overflow-hidden">
        {dimensions.width > 0 && (
            <div 
              style={{ width: dimensions.width, height: dimensions.height }}
              className="bg-white shadow-lg relative"
            >
                <svg 
                className="w-full h-full block touch-none select-none cursor-crosshair"
                onMouseDown={handleSvgClick}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                >
                <defs>{renderGrid()}</defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {baseMapImage && (
                    <image href={baseMapImage} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" opacity={0.5} style={{ pointerEvents: 'none' }} />
                )}

                {zones.map((zone) => (
                    <g key={zone.id}>
                        <polygon 
                        points={zone.points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={zone.type === ZoneType.WATER ? "rgba(59, 130, 246, 0.4)" : zone.type === ZoneType.GREENERY ? "rgba(34, 197, 94, 0.4)" : zone.type === ZoneType.STRUCTURE ? "rgba(147, 51, 234, 0.5)" : "rgba(156, 163, 175, 0.4)"}
                        stroke={zone.type === ZoneType.WATER ? "#3b82f6" : zone.type === ZoneType.GREENERY ? "#22c55e" : zone.type === ZoneType.STRUCTURE ? "#9333ea" : "#9ca3af"}
                        strokeWidth="2"
                        />
                        {mode === 'EDIT' && zone.points.map(p => (
                        <circle key={p.id} cx={p.x} cy={p.y} r="3" fill="#64748b" className="cursor-move" onMouseDown={(e) => handlePointMouseDown(e, p.id, 'zone', zone.id)} />
                        ))}
                    </g>
                ))}
                {mode === 'ZONE' && currentZonePoints.length > 0 && (
                    <g>
                        <polygon points={currentZonePoints.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(34, 197, 94, 0.1)" stroke="#22c55e" strokeDasharray="4"/>
                        <circle cx={currentZonePoints[0].x} cy={currentZonePoints[0].y} r="5" fill="#22c55e" className="cursor-pointer animate-pulse" onMouseDown={(e) => { e.stopPropagation(); finishZone(); }} />
                    </g>
                )}

                <path 
                    d={boundary.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (isClosed ? ' Z' : '')}
                    fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                />
                {boundary.map((p, i) => (
                    <circle key={p.id} cx={p.x} cy={p.y} r={mode === 'EDIT' ? 5 : 3} fill="white" stroke="#1e293b" strokeWidth="2" className={`${mode === 'EDIT' ? 'cursor-move' : ''}`} onMouseDown={(e) => handlePointMouseDown(e, p.id, 'boundary')} />
                ))}

                {roads.map((road) => (
                    <g key={road.id}>
                        <polyline points={road.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                        {mode === 'EDIT' && road.points.map(p => (
                        <circle key={p.id} cx={p.x} cy={p.y} r="3" fill="#ef4444" className="cursor-move" onMouseDown={(e) => handlePointMouseDown(e, p.id, 'road', road.id)} />
                        ))}
                    </g>
                ))}
                {mode === 'ROAD' && currentRoadPoints.length > 0 && (
                    <g>
                        <polyline points={currentRoadPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4"/>
                        <rect x={currentRoadPoints[currentRoadPoints.length-1].x - 10} y={currentRoadPoints[currentRoadPoints.length-1].y - 10} width="20" height="20" fill="transparent" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); finishRoad(); }} />
                    </g>
                )}

                {elevations.map((ep) => (
                    <g key={ep.id} className="cursor-pointer hover:opacity-80">
                    <circle cx={ep.x} cy={ep.y} r="4" fill="#2563eb" />
                    <line x1={ep.x-6} y1={ep.y} x2={ep.x+6} y2={ep.y} stroke="#2563eb" strokeWidth="1.5"/>
                    <line x1={ep.x} y1={ep.y-6} x2={ep.x} y2={ep.y+6} stroke="#2563eb" strokeWidth="1.5"/>
                    <text x={ep.x + 8} y={ep.y - 8} fontSize="12" fill="#1d4ed8" fontWeight="bold" style={{ textShadow: '0 0 4px white' }}>{ep.value.toFixed(2)}</text>
                    </g>
                ))}
                </svg>

                {baseMapImage && (
                    <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded shadow text-xs flex items-center gap-2">
                        <span className="font-bold text-slate-700">底图</span>
                        <button onClick={() => setIncludeBaseMap(!includeBaseMap)} className={`flex items-center gap-1 px-1.5 rounded transition-colors ${includeBaseMap ? 'text-brand-700' : 'text-slate-400'}`}>
                            {includeBaseMap ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

const ToolBtn = ({ active, onClick, icon, label, disabled, color }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    title={label}
    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg w-10 h-10 transition-all ${active ? 'bg-brand-100 text-brand-700' : disabled ? 'opacity-30 cursor-not-allowed text-slate-400' : `${color || 'text-slate-500'} hover:bg-slate-100`}`}
  >
    {icon}
  </button>
);

export default DrawingCanvas;