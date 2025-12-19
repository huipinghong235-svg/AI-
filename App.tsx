
import React, { useState, useRef } from 'react';
import { AppState, GeneratedImage, GeminiAspectRatio, AppMode } from './types';
import { generateReskin } from './services/geminiService';

const getClosestAspectRatio = (width: number, height: number): GeminiAspectRatio => {
  const ratio = width / height;
  const targets: { label: GeminiAspectRatio; value: number }[] = [
    { label: "1:1", value: 1.0 },
    { label: "3:4", value: 0.75 },
    { label: "4:3", value: 1.333 },
    { label: "9:16", value: 0.5625 },
    { label: "16:9", value: 1.777 },
  ];
  return targets.reduce((prev, curr) => 
    Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev
  ).label;
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    activeMode: 'transfer',
    sourceImage: null,
    sourceAspectRatio: "1:1",
    referenceStyleImage: null,
    customPrompt: '',
    isGenerating: false,
    results: []
  });

  const sourceInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);

  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const closestRatio = getClosestAspectRatio(img.naturalWidth, img.naturalHeight);
          setState(prev => ({ 
            ...prev, 
            sourceImage: base64,
            sourceAspectRatio: closestRatio,
            results: [] 
          }));
        };
        img.src = base64;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStyleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setState(prev => ({ ...prev, referenceStyleImage: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const startGeneration = async () => {
    if (!state.sourceImage) return;
    if (state.activeMode === 'transfer' && !state.referenceStyleImage) return;

    // 根据模式确定生成的数量
    let count = 1;
    if (state.activeMode === 'derive') count = 2;
    if (state.activeMode === 'transfer') count = 1;
    if (state.activeMode === 'refine') count = 1;

    setState(prev => ({
      ...prev,
      isGenerating: true,
      results: Array.from({ length: count }).map((_, i) => ({
        id: `gen-${i}`,
        url: '',
        status: 'loading'
      }))
    }));

    const generationPromises = Array.from({ length: count }).map(async (_, index) => {
      try {
        const url = await generateReskin(
          state.activeMode,
          state.sourceImage!, 
          state.customPrompt,
          state.referenceStyleImage,
          state.sourceAspectRatio
        );
        return { index, url, status: 'success' as const };
      } catch (err) {
        return { index, url: '', status: 'error' as const };
      }
    });

    const outcomes = await Promise.all(generationPromises);
    setState(prev => ({
      ...prev,
      isGenerating: false,
      results: outcomes.map(o => ({ id: `res-${o.index}`, url: o.url, status: o.status }))
    }));
  };

  const MODES = [
    { id: 'transfer', name: '风格迁移', icon: '🎨', desc: '上传主体图+风格图，赋予主体全新质感', count: 1 },
    { id: 'derive', name: '变体衍生', icon: '🌀', desc: '上传一张图，衍生出风格一致的新设计', count: 2 },
    { id: 'refine', name: '细节细化', icon: '✨', desc: '提升草图或低精图的渲染质量，不改风格', count: 1 },
  ];

  const currentModeInfo = MODES.find(m => m.id === state.activeMode);

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-100 flex flex-col items-center py-8 px-4">
      {/* Header */}
      <header className="w-full max-w-6xl mb-10 text-center">
        <h1 className="text-6xl font-black tracking-tighter mb-4 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
          SkinSwap AI Studio
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
          专业级材质工作站：支持变体衍生、风格迁移与高清细化。
        </p>
      </header>

      {/* Mode Switcher */}
      <div className="w-full max-w-4xl flex gap-4 mb-8">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setState(prev => ({ ...prev, activeMode: mode.id as AppMode, results: [] }))}
            className={`flex-1 p-5 rounded-3xl transition-all border-2 text-left group ${
              state.activeMode === mode.id 
                ? 'bg-cyan-500/10 border-cyan-500 shadow-lg shadow-cyan-500/20' 
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-3xl mb-2">{mode.icon}</div>
            <div className={`font-black text-sm mb-1 ${state.activeMode === mode.id ? 'text-cyan-400' : 'text-slate-300'}`}>
              {mode.name}
            </div>
            <div className="text-[10px] text-slate-500 font-medium leading-relaxed uppercase tracking-tighter">
              {mode.desc}
            </div>
          </button>
        ))}
      </div>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          {/* Section: Inputs */}
          <section className="glass rounded-[2.5rem] p-7 shadow-2xl">
            <h2 className="text-xl font-bold mb-5 flex items-center gap-3 text-cyan-400">
              <span className="flex items-center justify-center w-8 h-8 bg-cyan-600 rounded-full text-sm text-white font-black">1</span>
              {state.activeMode === 'refine' ? '原始草图' : '主体图片'}
            </h2>
            <div 
              onClick={() => sourceInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-[2rem] p-4 transition-all cursor-pointer group flex flex-col items-center justify-center min-h-[180px] ${
                state.sourceImage ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/50'
              }`}
            >
              {state.sourceImage ? (
                <div className="relative w-full overflow-hidden rounded-2xl shadow-lg flex items-center justify-center" style={{ aspectRatio: state.sourceAspectRatio.replace(':', '/') }}>
                  <img src={state.sourceImage} alt="Source" className="max-w-full max-h-full object-contain" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                    <span className="text-sm font-bold tracking-widest uppercase text-white">重新上传</span>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-4xl mb-2 opacity-30">📁</div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">点击上传</p>
                </div>
              )}
              <input type="file" ref={sourceInputRef} onChange={handleSourceChange} className="hidden" accept="image/*" />
            </div>

            {state.activeMode === 'transfer' && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-3 text-purple-400">
                  <span className="flex items-center justify-center w-8 h-8 bg-purple-600 rounded-full text-sm text-white font-black">2</span>
                  风格材质参考
                </h2>
                <div 
                  onClick={() => styleInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-[2rem] p-4 transition-all cursor-pointer group flex flex-col items-center justify-center min-h-[160px] ${
                    state.referenceStyleImage ? 'border-purple-500 bg-purple-500/10' : 'border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/50'
                  }`}
                >
                  {state.referenceStyleImage ? (
                    <div className="relative w-full h-32 overflow-hidden rounded-2xl">
                      <img src={state.referenceStyleImage} alt="Style" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <span className="text-[10px] font-black uppercase text-white">更换材质图</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-4xl mb-2 opacity-30">💎</div>
                      <p className="text-[10px] text-slate-500 font-bold px-4 leading-relaxed uppercase">上传参考图以提取“材质DNA”</p>
                    </div>
                  )}
                  <input type="file" ref={styleInputRef} onChange={handleStyleImageChange} className="hidden" accept="image/*" />
                </div>
              </div>
            )}

            <div className="mt-8 space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block">
                {state.activeMode === 'refine' ? '细化要求' : '提示词补充'}
              </label>
              <textarea 
                value={state.customPrompt}
                onChange={(e) => setState(prev => ({ ...prev, customPrompt: e.target.value }))}
                placeholder={state.activeMode === 'refine' ? "增加光影细节，体现金属质感..." : "例如：流体金属，超现实主义..."}
                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 h-24 resize-none"
              />
            </div>

            <button
              onClick={startGeneration}
              disabled={!state.sourceImage || state.isGenerating || (state.activeMode === 'transfer' && !state.referenceStyleImage)}
              className={`w-full mt-8 py-5 rounded-2xl font-black text-lg tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 ${
                !state.sourceImage || state.isGenerating || (state.activeMode === 'transfer' && !state.referenceStyleImage)
                  ? 'bg-slate-800 text-slate-600'
                  : 'bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white hover:brightness-110 shadow-cyan-500/20 shadow-lg'
              }`}
            >
              {state.isGenerating ? 'AI 正在分析重构...' : `生成 ${currentModeInfo?.count} 张${currentModeInfo?.name}变体`}
            </button>
          </section>
        </div>

        {/* Results */}
        <div className="lg:col-span-8">
          <section className="glass rounded-[3rem] p-10 h-full shadow-2xl relative min-h-[700px] flex flex-col">
            {!state.sourceImage && !state.isGenerating && state.results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-700 p-12 text-center opacity-40">
                <div className="w-40 h-40 mb-8 rounded-full border-4 border-dashed border-slate-800 flex items-center justify-center animate-pulse">
                  <div className="text-6xl">🎨</div>
                </div>
                <h3 className="text-3xl font-black mb-4 text-slate-400">准备绪，待命...</h3>
                <p className="max-w-md mx-auto text-lg text-slate-500">
                  当前模式：<span className="text-cyan-400 font-bold">{currentModeInfo?.name}</span>
                  <br/>
                  上传图片并点击生成，我们将为您创作变体。
                </p>
              </div>
            ) : (
              <div className={`grid gap-8 flex-1 items-center justify-center ${
                state.results.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto w-full' : 'grid-cols-2 w-full'
              }`}>
                {(state.isGenerating || state.results.length > 0) ? (
                   state.results.map((res) => (
                    <div 
                      key={res.id} 
                      className="group relative rounded-[2rem] bg-slate-900/80 overflow-hidden ring-1 ring-white/10 shadow-2xl flex items-center justify-center w-full"
                      style={{ aspectRatio: state.sourceAspectRatio.replace(':', '/') }}
                    >
                      {res.status === 'loading' ? (
                        <div className="w-full h-full loading-shimmer flex flex-col items-center justify-center">
                          <div className="text-cyan-400 font-black text-[10px] animate-pulse tracking-widest uppercase mb-2 text-center">
                            {state.activeMode.toUpperCase()} RENDERING...
                          </div>
                          <div className="w-24 h-0.5 bg-cyan-500/20 relative overflow-hidden mt-2">
                             <div className="absolute inset-0 bg-cyan-500 animate-[shimmer_2s_infinite]"></div>
                          </div>
                        </div>
                      ) : res.status === 'success' ? (
                        <>
                          <img src={res.url} alt="Result" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-end pb-10">
                            <a 
                              href={res.url} 
                              download={`${state.activeMode}-${res.id}.png`}
                              className="bg-cyan-500 text-white px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-cyan-400 transition-all shadow-xl"
                            >
                              下载高清变体
                            </a>
                          </div>
                        </>
                      ) : (
                        <div className="text-red-500 font-bold uppercase text-[10px]">生成失败</div>
                      )}
                    </div>
                  ))
                ) : (
                  Array.from({ length: currentModeInfo?.count || 1 }).map((_, i) => (
                    <div key={i} className="rounded-[2rem] bg-slate-900/30 border-2 border-slate-800/20 flex items-center justify-center border-dashed w-full" style={{ aspectRatio: state.sourceAspectRatio.replace(':', '/') }}>
                      <span className="text-slate-800 text-5xl font-black italic opacity-10 uppercase tracking-tighter">Variant {i+1}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {state.isGenerating && (
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-10 py-4 bg-cyan-600 rounded-full text-[12px] font-black tracking-widest uppercase shadow-2xl animate-pulse z-10">
                正在进行 {currentModeInfo?.name} ...
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="mt-20 text-slate-700 text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-6">
        <span>Powered by Gemini 2.5 Flash</span>
        <span className="w-1.5 h-1.5 bg-slate-800 rounded-full"></span>
        <span>Studio Quality Rendering</span>
        <span className="w-1.5 h-1.5 bg-slate-800 rounded-full"></span>
        <span>Aesthetic Consistency</span>
      </footer>
    </div>
  );
};

export default App;
