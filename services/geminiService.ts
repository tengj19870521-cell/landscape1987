import { GoogleGenAI, Type } from "@google/genai";
import { LandscapeStyle, AreaStats, AnalysisType, DesignDescription, ElevationPoint } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const cleanBase64 = (data: string) => data.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

/**
 * Generates the master landscape design with Intelligent Logic.
 */
export const generateLandscapeDesign = async (
  imageBase64: string,
  style: LandscapeStyle,
  promptText: string,
  elevations: ElevationPoint[],
  pixelToMeterScale: number
): Promise<string> => {
  const base64Data = cleanBase64(imageBase64);

  let topoInfo = "";
  if (elevations.length > 0) {
    topoInfo = "竖向设计强制要求：";
    elevations.forEach((ep, i) => {
      topoInfo += `[点${i+1}标高: +${ep.value.toFixed(1)}m] `;
    });
    topoInfo += "。请据此生成台地、阶梯或坡道以解决高差。";
  }

  // Chain-of-Thought Prompt for better quality
  const systemPrompt = `
    你是一位世界级的景观建筑师。你需要根据输入的【功能分区草图】生成一张【高精度专业彩平图】。
    
    【输入图例解码】:
    1. 红色线条 = 既定道路网 (必须保留位置，渲染为透水砖或石材路面)。
    2. 蓝色区块 = 水景 (需增加驳岸细节、倒影和波纹)。
    3. 绿色区块 = 种植区 (需区分乔木、灌木、草坪的层次)。
    4. 紫色区块 = 建筑/构筑物 (需渲染屋顶纹理和阴影)。
    5. 灰色区块 = 硬质广场 (需增加铺装拼花图案)。

    【设计逻辑 (Step-by-Step)】:
    1. 第一步：分析空间结构。确保道路连接顺畅，功能区之间有合理的过渡（如绿篱或铺装渐变）。
    2. 第二步：应用风格 "${style}"。
       - 如果是现代风，使用几何线条和简洁铺装。
       - 如果是中式，增加假山、曲桥和松竹。
    3. 第三步：深化细节。在道路两侧增加行道树，在广场增加座椅/遮阳伞，在水边增加亲水平台。
    4. 第四步：光影渲染。假设阳光从左上方射入，为所有立树木和建筑投下清晰的阴影，增强立体感。
    
    【输出要求】:
    - 严禁改变输入色块的形状和位置（这是强制约束）。
    - 图像必须是正射投影（Top Down View）。
    - 画面清晰度极高，无噪点，色彩和谐。
    ${topoInfo}
  `;

  const userPrompt = promptText 
    ? `用户特殊指令: ${promptText}` 
    : "请进行高品质的材质贴图渲染，使其看起来像一张最终汇报的彩平图。";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: systemPrompt + "\n" + userPrompt },
          { inlineData: { mimeType: 'image/png', data: base64Data } }
        ]
      },
      config: {
        safetySettings: [
           { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
           { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
           { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
           { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error("生成失败");

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("无图像返回");
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

/**
 * Generates Validation Analysis (Simplified)
 */
export const generateAnalysisMap = async (
  masterPlanBase64: string,
  type: AnalysisType
): Promise<string> => {
  const base64Data = cleanBase64(masterPlanBase64);
  
  // Only Function Analysis remains
  const analysisPrompt = `
    任务：基于这张平面图生成一张【功能结构分析图】(Functional Diagram)。
    - 将图面抽象化，用柔和的半透明色块覆盖主要区域。
    - 蓝色=水系，绿色=生态基底，黄色=活动节点，红色=交通流线。
    - 用虚线圆圈标记出主要的景观节点。
    - 风格：清晰的图解分析风格，背景黑白处理。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: analysisPrompt },
          { inlineData: { mimeType: 'image/png', data: base64Data } }
        ]
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    for (const part of parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
    return masterPlanBase64; 
  } catch (error) {
    return masterPlanBase64;
  }
};

export const analyzeLandscapeStats = async (
  style: LandscapeStyle,
  promptText: string
): Promise<AreaStats> => {
  const prompt = `
    Based on a ${style} landscape design.
    Return JSON: {greenery, paving, water, structures, other} (numbers summing to 100).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            greenery: { type: Type.NUMBER },
            paving: { type: Type.NUMBER },
            water: { type: Type.NUMBER },
            structures: { type: Type.NUMBER },
            other: { type: Type.NUMBER }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return { greenery: 40, paving: 40, water: 10, structures: 10, other: 0 };
    return JSON.parse(text) as AreaStats;
  } catch (error) {
    return { greenery: 45, paving: 35, water: 10, structures: 5, other: 5 };
  }
};

export const generateDesignDescription = async (
  style: LandscapeStyle,
  promptText: string,
  stats: AreaStats | null
): Promise<DesignDescription> => {
  const prompt = `
    作为设计师，为"${style}"风格景观写说明。
    用户指令: "${promptText}"。
    JSON格式返回: {concept: "150字内理念", features: ["3-5个亮点"]}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            concept: { type: Type.STRING },
            features: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return { concept: "生成说明失败", features: [] };
    return JSON.parse(text) as DesignDescription;
  } catch (error) {
    return { concept: "设计融合了现代美学与生态功能。", features: ["生态水景", "多功能活动场"] };
  }
};