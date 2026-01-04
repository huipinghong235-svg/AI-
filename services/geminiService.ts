import { GoogleGenAI } from "@google/genai";
import { GeminiAspectRatio, AppMode } from "../types";

export async function generateReskin(
  mode: AppMode,
  base64Source: string,
  customPrompt: string = "",
  base64Reference: string | null = null,
  aspectRatio: GeminiAspectRatio = "1:1",
  intensity: number = 0.5
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

  if (mode === 'derive') {
    finalPrompt = `
      Role: Expert Concept Artist for Game UI and Assets.
      Task: Create a professional "Concept Variant Sheet" in ONE single composite image.
      
      CORE REQUIREMENTS:
      1. COMPOSITE LAYOUT: Generate exactly ONE image that contains a 2x2 grid showing 4 distinct visual variants of the input object.
      2. OBJECT CONSISTENCY: Each of the 4 variants MUST be the same object category as the input (e.g., if input is a sunglasses icon, generate 4 sunglasses variants).
      3. ART STYLE LOCK: Maintain the exact same rendering style, line weight, and perspective as the original image.
      4. DESIGN DIVERSIFICATION: Each variant should have unique colors, textures, materials, and small ornamental details while keeping the core silhouette.
      5. BACKGROUND: Use a clean, consistent environment or theme for the whole sheet.
      
      User Details: ${customPrompt}
      Creativity Level: ${intensity}
    `;
  } else if (mode === 'transfer' && base64Reference) {
    parts.push({
      inlineData: {
        data: base64Reference.split(',')[1] || base64Reference,
        mimeType: 'image/png',
      },
    });

    finalPrompt = `
      Task: Material and Texture Transfer. 
      Map the visual style, lighting, and materials of Image 2 onto the structure of Image 1.
      Create a 2x2 grid of 4 variants showing slightly different applications of this material.
      Intensity: ${intensity}. ${customPrompt}
    `;
  } else if (mode === 'refine') {
    finalPrompt = `
      Task: High-Fidelity Asset Polish. 
      Generate a single high-resolution, polished version of the asset.
      Increase detail density, improve specular highlights, and sharpen textures.
      User specific focus: ${customPrompt}
    `;
  }

  parts.push({ text: finalPrompt + `\nOutput strictly as a single composite image in ${aspectRatio} aspect ratio.` });

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
    throw new Error("No image data found in AI response.");
  } catch (error: any) {
    console.error("Gemini Flash Error:", error);
    throw error;
  }
}