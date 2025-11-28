import React, { useState, useCallback } from 'react';
import DrawingCanvas from './components/DrawingCanvas';
import ControlPanel from './components/ControlPanel';
import ResultViewer from './components/ResultViewer';
import { generateLandscapeDesign, analyzeLandscapeStats, generateAnalysisMap, generateDesignDescription } from './services/geminiService';
import { LandscapeStyle, GenerationConfig, AreaStats, Point, GeneratedResults, AnalysisType, ElevationPoint, Road, Zone, AspectRatio } from './types';
import { AlertCircle, ChevronRight, PenTool } from 'lucide-react';

const App: React.FC = () => {
  const [sketchImage, setSketchImage] = useState<string | null>(null);
  
  const [results, setResults] = useState<GeneratedResults>({
    master: null,
    function: null,
    description: null
  });
  const [stats, setStats] = useState<AreaStats | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [drawingPath, setDrawingPath] = useState<Point[]>([]); 
  const [elevations, setElevations] = useState<ElevationPoint[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [pixelToMeterScale, setPixelToMeterScale] = useState(1);
  
  const [config, setConfig] = useState<GenerationConfig>({
    style: LandscapeStyle.MODERN,
    additionalPrompt: "",
    siteWidth: 30,
    aspectRatio: AspectRatio.LANDSCAPE
  });

  const handleSketchUpdate = useCallback((imageData: string | null) => {
    setSketchImage(imageData);
  }, []);

  const handleDataUpdate = useCallback((
    boundary: Point[], 
    roadsData: Road[], 
    zonesData: Zone[], 
    elevs: ElevationPoint[], 
    width: number, 
    height: number, 
    scale: number
  ) => {
    setDrawingPath(boundary);
    setRoads(roadsData);
    setZones(zonesData);
    setElevations(elevs);
    setCanvasDimensions({ width, height });
    setPixelToMeterScale(scale);
  }, []);

  const handleGenerate = async () => {
    if (!sketchImage) return;

    setIsGenerating(true);
    setError(null);
    setStats(null);
    setResults({ master: null, function: null, description: null });

    try {
      // 1. Generate Master Plan
      const imageResult = await generateLandscapeDesign(
        sketchImage,
        config.style,
        config.additionalPrompt,
        elevations,
        pixelToMeterScale
      );

      // 2. Generate Stats & Description in parallel
      const statsPromise = analyzeLandscapeStats(config.style, config.additionalPrompt);
      const descPromise = generateDesignDescription(config.style, config.additionalPrompt, null);

      const [statsResult, descResult] = await Promise.all([statsPromise, descPromise]);
      
      setResults(prev => ({ ...prev, master: imageResult, description: descResult }));
      setStats(statsResult);
      
    } catch (err: any) {
      setError(err.message || "生成失败，请重试");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAnalysis = async (type: AnalysisType) => {
    if (!results.master) return;
    setIsAnalyzing(true);
    try {
      const analysisImage = await generateAnalysisMap(results.master, type);
      setResults(prev => ({ ...prev, function: analysisImage }));
    } catch (err: any) {
      setError(`分析图生成失败: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-lg shadow-sm">
              <PenTool size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                LandscapeGenie <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Smart</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">AI 智能景观生成器</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 py-6 h-[calc(100vh-4rem)]">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700 text-sm animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-6">
          <div className="lg:col-span-5 flex flex-col gap-6 h-full overflow-hidden">
            <div className="flex-[3] min-h-[300px]">
              <DrawingCanvas 
                onImageUpdate={handleSketchUpdate} 
                onDataUpdate={handleDataUpdate}
                siteWidthMeters={config.siteWidth}
                aspectRatio={config.aspectRatio}
              />
            </div>
            <div className="flex-[2] h-auto overflow-hidden">
              <ControlPanel 
                config={config} 
                isGenerating={isGenerating} 
                onConfigChange={setConfig}
                onGenerate={handleGenerate}
                canGenerate={!!sketchImage}
              />
            </div>
          </div>

          <div className="lg:col-span-7 h-full flex flex-col overflow-hidden">
            <ResultViewer 
              results={results}
              stats={stats}
              isGenerating={isGenerating}
              isAnalyzing={isAnalyzing}
              drawingPath={drawingPath}
              elevations={elevations}
              roads={roads}
              zones={zones}
              canvasDimensions={canvasDimensions}
              pixelToMeterScale={pixelToMeterScale}
              onGenerateAnalysis={handleGenerateAnalysis}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;