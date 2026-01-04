
export type AppMode = 'derive' | 'transfer' | 'refine';

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
  previewUrl: string;
}

export interface GeneratedImage {
  id: string;
  url: string;
  status: 'loading' | 'success' | 'error';
  mode?: AppMode;
  timestamp?: number;
}

export type GeminiAspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export interface AppState {
  activeMode: AppMode;
  sourceImage: string | null;
  sourceAspectRatio: GeminiAspectRatio;
  referenceStyleImage: string | null;
  customPrompt: string;
  generateCount: number;
  intensity: number;
  isGenerating: boolean;
  results: GeneratedImage[];
  history: GeneratedImage[];
}
