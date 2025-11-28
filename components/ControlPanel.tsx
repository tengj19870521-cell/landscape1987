import React from 'react';
import { LandscapeStyle, GenerationConfig, AspectRatio } from '../types';
import { Sparkles, Loader2, Ruler, LayoutTemplate } from 'lucide-react';

interface ControlPanelProps {
  config: GenerationConfig;
  isGenerating: boolean;
  onConfigChange: (newConfig: GenerationConfig) => void;
  onGenerate: () => void;
  canGenerate: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  config, 
  isGenerating, 
  onConfigChange, 
  onGenerate,
  canGenerate
}) => {
  
  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({ ...config, style: e.target.value as LandscapeStyle });
  };

  const handleRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({ ...config, aspectRatio: e.target.value as AspectRatio });
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onConfigChange({ ...config, additionalPrompt: e.target.value });
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      onConfigChange({ ...config, siteWidth: val });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-6 h-full overflow-y-auto">
      <div>
        <h3 className="font-medium text-slate-700 text-sm tracking-wide mb-4 flex items-center gap-2">
            <LayoutTemplate size={16}/>
            项目设置 (Project Setup)
        </h3>
        
        {/* Scale & Ratio Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                    场地宽度
                </label>
                <div className="relative rounded-md shadow-sm">
                    <input
                    type="number"
                    value={config.siteWidth}
                    onChange={handleWidthChange}
                    className="block w-full rounded-lg border-slate-200 pl-3 focus:border-brand-500 focus:ring-brand-500 text-sm py-2 bg-slate-50 border"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <span className="text-slate-500 text-xs">米</span>
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                    输出比例
                </label>
                <select
                    value={config.aspectRatio}
                    onChange={handleRatioChange}
                    disabled={isGenerating}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                    <option value={AspectRatio.LANDSCAPE}>4:3 (常规)</option>
                    <option value={AspectRatio.PORTRAIT}>3:4 (竖版)</option>
                    <option value={AspectRatio.SQUARE}>1:1 (方形)</option>
                    <option value={AspectRatio.WIDE}>16:9 (宽屏)</option>
                </select>
            </div>
        </div>

        <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
          设计风格 (Style)
        </label>
        <div className="relative mb-4">
          <select
            value={config.style}
            onChange={handleStyleChange}
            disabled={isGenerating}
            className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-800 text-sm font-medium"
          >
            {Object.values(LandscapeStyle).map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
          智能设计指令 (AI Instruction)
        </label>
        <textarea
          value={config.additionalPrompt}
          onChange={handlePromptChange}
          disabled={isGenerating}
          placeholder="例如：这是个养老社区花园，请增加无障碍坡道，铺装使用暖色调透水砖，植物以疗愈芳香植物为主..."
          className="w-full h-40 p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-700 resize-none text-sm placeholder:text-slate-400 leading-relaxed"
        />
      </div>

      <button
        onClick={onGenerate}
        disabled={isGenerating || !canGenerate}
        className={`
          w-full py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all shadow-lg
          ${isGenerating || !canGenerate
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
            : 'bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-700 hover:to-brand-600 shadow-brand-200 hover:shadow-brand-300 transform hover:-translate-y-0.5'
          }
        `}
      >
        {isGenerating ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            AI 正在设计...
          </>
        ) : (
          <>
            <Sparkles size={20} />
            生成优化方案
          </>
        )}
      </button>
      {!canGenerate && !isGenerating && (
        <p className="text-xs text-center text-slate-400">请先在左侧绘制闭合的场地边界</p>
      )}
    </div>
  );
};

export default ControlPanel;