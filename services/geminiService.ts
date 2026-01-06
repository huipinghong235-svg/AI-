
import { GoogleGenAI } from "@google/genai";
import { GeminiAspectRatio, AppMode } from "../types";

export async function generateReskin(
  mode: AppMode,
  base64Source: string,
  customPrompt: string = "",
  base64Reference: string | null = null,
  aspectRatio: GeminiAspectRatio = "1:1",
  intensity: number = 1.0
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const sourcePart = {
    inlineData: {
      data: base64Source.split(',')[1] || base64Source,
      mimeType: 'image/png',
    },
  };

  const parts: any[] = [sourcePart];
  let finalPrompt = "";

  // 动态构建强度指令
  let intensityInstruction = "";
  if (intensity < 0.2) {
    intensityInstruction = `
      【极低重构幅度 - 0% 级控制】：
      - 绝对克隆：保持原图的几何轮廓、线条分布和部件位置 95% 以上一致。
      - 微调模式：仅允许修改材质的反光度、微小的表面纹理（如：增加一点磨损或高光）以及细微的色调偏差。
      - 目标：看起来像是同一件物品在不同光线下的微小差异版本。
    `;
  } else if (intensity >= 0.4 && intensity <= 0.6) {
    intensityInstruction = `
      【标准重构幅度 - 50% 级控制】：
      - 结构守恒：保留主体的核心骨架和识别特征（如：如果是椰子杯，外壳必须还是圆形或椰子状）。
      - 中度迭代：允许重新设计次要组件。例如：改变吸管的形状、更换装饰花卉的品种、改变液体的颜色。
      - 目标：看起来像是“同系列”但“不同批次”的设计方案。
    `;
  } else if (intensity > 0.8) {
    intensityInstruction = `
      【极致重构幅度 - 100% 级控制】：
      - 品类延续：只需保留物体的物理类别（例如：只要生成物还是“饮品”或“头盔”即可）。
      - 彻底重构：完全颠覆原有的几何形状、材质构成、装饰逻辑。
      - 极致发散：追求与原图完全不同的视觉表现力，展现该品类的另一种可能形态。
      - 目标：跨越维度的全新概念方案，仅保留原图的艺术画法。
    `;
  } else {
    // 渐进式过渡
    intensityInstruction = `重构强度设置为 ${(intensity * 100).toFixed(0)}%。请在此强度下进行设计演变。`;
  }

  if (mode === 'derive') {
    finalPrompt = `
      ### 工业级资产变体引擎 (Variant Engine v3.0) ###

      你现在是全球顶尖的游戏概念设计师。你的任务是生成一个【2x2 设计变体表】。

      #### 逻辑 1：自主视觉分析 ####
      ${!customPrompt.trim() ? "当前没有用户提示词。请你首先深度识别参考图中的主体（例如：热带椰子饮品、科技头盔、复古宝箱等），并自主提取其核心设计语言。" : `用户已指定重点：${customPrompt}`}

      #### 逻辑 2：设计演变指令 ####
      ${intensityInstruction}

      #### 逻辑 3：空间与美学约束 ####
      - 空间布局：必须生成 2x2 阵列。如果原图是复合图标组，请维持 1:1 的位置映射进行换皮；如果原图是单体，请生成 4 个单体变体。
      - 风格锁：必须 100% 复刻原图的艺术笔触、光影逻辑（如：AO阴影强度、高光锐度、饱和度）。
      - 材质表现：根据重构幅度，展现出扎实、高精度、符合 4K 工业标准的材质细节。
      - 构图要求：居中且充满画面，比例必须为 ${aspectRatio}。

      输出必须是一张包含 4 个变体方案的单体概念图。
    `;
  } else if (mode === 'transfer' && base64Reference) {
    parts.push({
      inlineData: {
        data: base64Reference.split(',')[1] || base64Reference,
        mimeType: 'image/png',
      },
    });

    finalPrompt = `
      任务：跨图材质克隆。
      将图2的【高级材质、色彩风格、渲染质感】迁移到图1的【结构轮廓】上。
      以 2x2 阵列生成 4 组在强度 ${intensity} 下的演变结果。
      描述参考：${customPrompt}
    `;
  } else if (mode === 'refine') {
    finalPrompt = `
      任务：高保真细节细化 (Industrial Refinement)。
      在 0% 强度的控制下，对原图进行无损细节堆叠。
      提升每一处高光的真实感，增强材质的密度，锐化边缘，保持 100% 构图一致。
    `;
  }

  parts.push({ text: finalPrompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
      config: {
        imageConfig: { 
          aspectRatio: aspectRatio
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("渲染失败：未获取到有效的图像流。");
  } catch (error: any) {
    console.error("Gemini System Error:", error);
    throw error;
  }
}
