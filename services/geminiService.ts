
import { GoogleGenAI } from "@google/genai";
import { GeminiAspectRatio, AppMode } from "../types";

export async function generateReskin(
  mode: AppMode,
  base64Source: string,
  customPrompt: string = "",
  base64Reference: string | null = null,
  aspectRatio: GeminiAspectRatio = "1:1"
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const parts: any[] = [
    {
      inlineData: {
        data: base64Source.split(',')[1] || base64Source,
        mimeType: 'image/png',
      },
    }
  ];

  let finalPrompt = "";

  if (mode === 'derive') {
    // 衍生变体：保持风格，改变形状
    finalPrompt = `
      任务：【材质衍生与结构重构】。
      指令：
      1. 深度分析上传图片的视觉DNA，包括材质感、色彩托盘、光影效果和渲染风格。
      2. 创造一个全新的物体或设计，其必须具有与原图完全一致的视觉风格。
      3. 【重要】改变其物理形状和结构设计，使其看起来像是一个新产品或新角色，但属于同一个品牌或宇宙。
      4. 保持电影级的细节丰富度和 4K 级别的渲染清晰度。
      额外描述：${customPrompt}
    `;
  } else if (mode === 'transfer' && base64Reference) {
    // 风格迁移：图1是形，图2是色/质
    parts.push({
      inlineData: {
        data: base64Reference.split(',')[1] || base64Reference,
        mimeType: 'image/png',
      },
    });
    finalPrompt = `
      任务：【跨图风格迁移】。将图 2 的材质和艺术风格精准应用到图 1 的物体上。
      指令：
      1. 保留图 1 物体的核心结构、形状和功能特征。
      2. 提取图 2 的材质纹理（如流体金属、发光晶体、粗糙皮革等）、光影环境和配色。
      3. 将图 2 的“外壳”无缝包裹在图 1 的“骨架”上。
      4. 严禁改变图 1 的基础形状。
      额外描述：${customPrompt}
    `;
  } else if (mode === 'refine') {
    // 细节增强：高清细化，不改风格
    finalPrompt = `
      任务：【超高清工业细化】。
      指令：
      1. 对这张原始草图或低精图进行专业的后期渲染增强。
      2. 严禁改变物体的基本形状、构图和配色。
      3. 增加微观细节：如金属拉丝纹、极其真实的物理反射、环境光遮蔽（AO）和清晰的边缘锐度。
      4. 模拟高级 3D 软件（如 Octane 或 Redshift）的渲染效果，使图片达到商业发布级别。
      额外描述：${customPrompt}
    `;
  }

  parts.push({ text: finalPrompt + ` 必须严格遵守 ${aspectRatio} 比例。` });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
      config: {
        imageConfig: { aspectRatio: aspectRatio }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found.");
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
}
