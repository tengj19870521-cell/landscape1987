export enum LandscapeStyle {
  MODERN = "现代极简风 (Modern Minimalist)",
  NEW_CHINESE = "新中式园林 (New Chinese)",
  JAPANESE = "日式枯山水 (Japanese Zen)",
  EDSA = "EDSA 度假风 (EDSA Resort Style)",
  SWA = "SWA 生态现代风 (SWA Ecological)",
  AECOM = "AECOM 城市景观 (AECOM Urban)",
  ENGLISH = "英式自然花园 (English Cottage)",
  CLASSICAL = "古典欧式 (Classical European)"
}

export enum AnalysisType {
  MASTER_PLAN = "平面总图",
  FUNCTION = "功能分区验证"
}

export enum ZoneType {
  WATER = "水体 (Water)",
  GREENERY = "绿地 (Greenery)",
  PAVING = "硬质广场 (Plaza)",
  STRUCTURE = "建筑/构筑物 (Structure)"
}

export enum AspectRatio {
  SQUARE = "1:1",
  LANDSCAPE = "4:3",
  PORTRAIT = "3:4",
  WIDE = "16:9"
}

export interface GenerationConfig {
  style: LandscapeStyle;
  additionalPrompt: string;
  siteWidth: number; // Real world width in meters
  aspectRatio: AspectRatio;
}

export interface AreaStats {
  greenery: number;
  paving: number;
  water: number;
  structures: number;
  other: number;
}

export interface DesignDescription {
  concept: string;
  features: string[];
}

export interface GeneratedResults {
  master: string | null;
  function: string | null;
  description: DesignDescription | null;
}

export interface Point {
  x: number;
  y: number;
  id: string; // Unique ID for key for React lists
}

export interface ElevationPoint extends Point {
  value: number; // Height in meters (e.g. 5.5)
}

export interface Road {
  id: string;
  points: Point[];
  width: number; // visual width
}

export interface Zone {
  id: string;
  points: Point[]; // For polygon zones or center+radius for circles (simplified to poly for now)
  type: ZoneType;
}