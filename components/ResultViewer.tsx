import React, { useState } from 'react';
import { Download, FileCode, PieChart, Layers, Map as MapIcon, FileText, Eye, EyeOff } from 'lucide-react';
import { AreaStats, Point, GeneratedResults, AnalysisType, ElevationPoint, Road, Zone, ZoneType } from '../types';
import { generateDXF } from '../utils/dxf';

interface ResultViewerProps {
  results: GeneratedResults;
  stats: AreaStats | null;
  isGenerating: boolean;
  drawingPath: Point[]; 
  elevations: ElevationPoint[];
  roads: Road[];
  zones: Zone[];
  canvasDimensions: { width: number, height: number };
  pixelToMeterScale: number;
  onGenerateAnalysis: (type: AnalysisType) => void;
  isAnalyzing: boolean;
}

const ResultViewer: React.FC<ResultViewerProps> = ({ 
  results, 
  stats,
  isGenerating, 
  drawingPath,
  elevations,
  roads,
  zones,
  canvasDimensions,
  pixelToMeterScale,
  onGenerateAnalysis,
  isAnalyzing
}) => {
  const [activeTab, setActiveTab] = useState<AnalysisType>(AnalysisType.MASTER_PLAN);
  const [showVectorOverlay, setShowVectorOverlay] = useState(false);
  
  const currentImage = activeTab === AnalysisType.MASTER_PLAN ? results.master : results.function;

  const handleDownloadImage = () => {
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `landscape-${activeTab}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadDXF = () => {
    if (drawingPath.length === 0) {
      alert("没有轮廓数据，无法导出。");
      return;
    }
    const dxfContent = generateDXF(drawingPath, elevations, roads, zones, canvasDimensions.height, pixelToMeterScale);
    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `landscape-scheme.dxf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderVectorOverlay = () => {
    if (!showVectorOverlay) return null;
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-60 mix-blend-multiply" viewBox={`0 0 ${canvasDimensions.width} ${canvasDimensions.height}`}>
          {roads.map(road => (
            <polyline key={road.id} points={road.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ff0000" strokeWidth="4" />
          ))}
          {zones.map(zone => (
            <polygon key={zone.id} points={zone.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={zone.type === ZoneType.WATER ? "blue" : zone.type === ZoneType.GREENERY ? "green" : zone.type === ZoneType.STRUCTURE ? "purple" : "gray"} strokeWidth="2" strokeDasharray="5 5" />
          ))}
      </svg>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-3 border-b border-slate-100 bg-slate-50 gap-3">
        <div className="flex bg-slate-200 rounded-lg p-1 gap-1">
           <TabButton 
             active={activeTab === AnalysisType.MASTER_PLAN} 
             onClick={() => setActiveTab(AnalysisType.MASTER_PLAN)}
             icon={<MapIcon size={14}/>}
             label="彩平方案 (Render)"
           />
           <TabButton 
             active={activeTab === AnalysisType.FUNCTION} 
             onClick={() => {
               setActiveTab(AnalysisType.FUNCTION);
               if (results.master && !results.function) onGenerateAnalysis(AnalysisType.FUNCTION);
             }}
             icon={<Layers size={14}/>}
             label="功能验证 (Diagram)"
             disabled={!results.master}
           />
        </div>
        
        {currentImage && (
          <button 
           onClick={() => setShowVectorOverlay(!showVectorOverlay)}
           className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors shadow-sm ${showVectorOverlay ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-white text-slate-500 border-slate-200'}`}
          >
            {showVectorOverlay ? <Eye size={14}/> : <EyeOff size={14}/>}
            叠加矢量线
          </button>
        )}
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row h-[500px] md:h-auto overflow-hidden">
        {/* Main View Area */}
        <div className={`relative flex-1 bg-slate-100 flex items-center justify-center p-0 ${stats ? 'border-b md:border-b-0 md:border-r border-slate-200' : ''}`}>
          {currentImage ? (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <div className="relative max-w-full max-h-full">
                <img 
                    src={currentImage} 
                    alt="Generated Landscape" 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md bg-white border border-slate-200"
                />
                {renderVectorOverlay()}
              </div>
            </div>
          ) : (
            <div className="text-center p-8 max-w-sm">
                {isGenerating || (isAnalyzing && activeTab !== AnalysisType.MASTER_PLAN && !currentImage) ? (
                    <div className="flex flex-col items-center gap-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-slate-800 font-medium">正在智能生成...</h4>
                        <p className="text-xs text-slate-500">AI 正在推敲空间布局与材质细节</p>
                    </div>
                    </div>
                ) : (
                <div className="flex flex-col items-center gap-3 opacity-60">
                    <h4 className="text-slate-500 font-medium">暂无方案</h4>
                    <p className="text-xs text-slate-400">请设置比例并生成</p>
                </div>
                )}
            </div>
          )}
        </div>

        {/* Stats & Info Panel */}
        {results.master && (
          <div className="w-full md:w-80 bg-slate-50 flex flex-col border-l border-slate-200 h-1/2 md:h-auto overflow-hidden">
             
             <div className="p-5 border-b border-slate-200 bg-white overflow-y-auto max-h-[250px]">
               {results.description && (
                   <>
                    <div className="flex items-center gap-2 text-slate-800 font-semibold mb-3">
                        <FileText size={16} className="text-brand-600"/>
                        <span className="text-sm">智能方案说明</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed text-justify mb-4">
                        {results.description.concept}
                    </p>
                    <div className="space-y-2">
                        {results.description.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                            <span className="text-brand-500 font-bold">•</span>
                            <span>{feat}</span>
                        </div>
                        ))}
                    </div>
                   </>
               )}
             </div>

             <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
                {stats && (
                 <>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold mb-3">
                    <PieChart size={16} className="text-brand-600"/>
                    <span className="text-sm">平衡性指标</span>
                  </div>
                  <div className="space-y-3">
                      <StatBar label="绿化 (Green)" value={stats.greenery} color="bg-green-500" />
                      <StatBar label="铺装 (Hardscape)" value={stats.paving} color="bg-stone-400" />
                      <StatBar label="水体 (Water)" value={stats.water} color="bg-blue-400" />
                      <StatBar label="建筑 (Structure)" value={stats.structures} color="bg-purple-400" />
                  </div>
                 </>
                )}
             </div>

             <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="grid grid-cols-2 gap-2">
                   <button 
                     onClick={handleDownloadDXF}
                     className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors"
                   >
                     <FileCode size={14} />
                     CAD 导出
                   </button>
                   <button 
                     onClick={handleDownloadImage}
                     className="col-span-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                   >
                     <Download size={14} />
                     下载高清图
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label, disabled }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${active ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50'} ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`}
  >
    {icon} {label}
  </button>
);

const StatBar = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-900 font-bold">{value}%</span>
    </div>
    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }}></div>
    </div>
  </div>
);

export default ResultViewer;