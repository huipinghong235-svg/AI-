import React, { useState, useRef, useEffect } from 'react';
import { AppState, GeneratedImage, GeminiAspectRatio, AppMode } from './types';
import { generateReskin } from './services/geminiService';

// IndexedDB Helper for persistent storage of large base64 images
const DB_NAME = 'SkinSwapDB';
const STORE_NAME = 'history';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveToDB = async (item: GeneratedImage) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(item);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
};

const loadAllFromDB = async (): Promise<GeneratedImage[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const data = request.result as GeneratedImage[];
      resolve(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    };
    request.onerror = () => reject(request.error);
  });
};

const deleteFromDB = async (id: string) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
};

const clearDB = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
};

const MAX_HISTORY_ITEMS = 100;

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
    activeMode: 'derive', 
    sourceImage: null,
    sourceAspectRatio: "1:1",
    referenceStyleImage: null,
    customPrompt: '',
    generateCount: 1, 
    intensity: 1.0,
    isGenerating: false,
    results: [],
    history: []
  });

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const sourceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    };
    checkKey();

    // Load history from IndexedDB instead of LocalStorage
    loadAllFromDB().then(data => {
      setState(prev => ({ ...prev, history: data }));
    }).catch(err => console.error("Failed to load IndexedDB history", err));
  }, []);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
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
  };

  const startGeneration = async () => {
    if (!state.sourceImage) return;

    if (hasKey === false) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }

    const count = state.generateCount;
    setState(prev => ({
      ...prev,
      isGenerating: true,
      results: Array.from({ length: count }).map((_, i) => ({ id: `gen-${i}`, url: '', status: 'loading' }))
    }));

    const generationPromises = Array.from({ length: count }).map(async () => {
      try {
        const url = await generateReskin(
          'derive',
          state.sourceImage!, 
          state.customPrompt,
          null,
          state.sourceAspectRatio,
          state.intensity
        );
        return { url, status: 'success' as const };
      } catch (err: any) {
        return { url: '', status: 'error' as const };
      }
    });

    const outcomes = await Promise.all(generationPromises);
    const timestamp = Date.now();
    const newResults: GeneratedImage[] = outcomes.map((o, i) => ({ 
      id: `res-${timestamp}-${i}`, 
      url: o.url, 
      status: o.status,
      timestamp: timestamp
    }));

    const successfulResults = newResults.filter(r => r.status === 'success');
    
    // Save new results to IndexedDB
    for (const res of successfulResults) {
      await saveToDB(res);
    }

    // Refresh history state
    const updatedHistory = await loadAllFromDB();
    const prunedHistory = updatedHistory.slice(0, MAX_HISTORY_ITEMS);
    
    // If we pruned, delete excess from DB
    if (updatedHistory.length > MAX_HISTORY_ITEMS) {
      const toDelete = updatedHistory.slice(MAX_HISTORY_ITEMS);
      for (const item of toDelete) await deleteFromDB(item.id);
    }

    setState(prev => ({ 
      ...prev, 
      isGenerating: false, 
      results: newResults,
      history: prunedHistory
    }));
  };

  const handlePlaceHistoryItem = (url: string) => {
    const img = new Image();
    img.onload = () => {
      const closestRatio = getClosestAspectRatio(img.naturalWidth, img.naturalHeight);
      setState(prev => ({ 
        ...prev, 
        sourceImage: url, 
        sourceAspectRatio: closestRatio,
        results: []
      }));
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    img.src = url;
  };

  const handleClearHistory = async () => {
    if (confirm("确定永久清空所有历史存档吗？")) {
      await clearDB();
      setState(p => ({ ...p, history: [] }));
    }
  };

  return (
    <div className="min-h-screen bg-[#050b1a] text-slate-200 p-4 md:p-8 font-sans selection:bg-cyan-500 selection:text-white">
      
      {/* Top Header */}
      <header className="max-w-[1400px] mx-auto flex items-center justify-center mb-10">
        <div className="flex items-center gap-2 cursor-pointer group">
          <span className="text-2xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">萍果AI - 智能换皮工具</span>
          <span className="text-slate-500 group-hover:text-cyan-400 transition-colors">✎</span>
        </div>
      </header>

      {/* Mode Banner & Status - Combined into one horizontal line */}
      <section className="max-w-[1400px] mx-auto flex justify-center items-center gap-4 mb-12">
        <div className="px-8 py-3 rounded-full glass border border-cyan-500/40 flex items-center gap-6 shadow-xl shadow-cyan-500/5 transition-all hover:border-cyan-500/60">
          <div className="flex items-center gap-3">
            <span className="text-xl">🌀</span>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-400">变体衍生</h3>
          </div>
          
          <div className="w-px h-5 bg-white/10"></div>
          
          <div className="flex items-center gap-2.5 px-4 py-1.5 bg-purple-900/30 border border-purple-500/40 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">VARIANT DERIVATION ACTIVE</span>
          </div>
          
          <div className="hidden sm:block text-[9px] text-slate-500 uppercase tracking-tighter font-bold border-l border-white/10 pl-6">
            单次生成 4 套全新外观方案，保留原有风格
          </div>
        </div>
      </section>

      <main className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Control Panel - lg:col-span-3 (25%) */}
        <aside className="lg:col-span-3 glass rounded-[2.5rem] p-6 space-y-8 border-white/5">
          {/* Source Image */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="bg-cyan-500 text-black text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full">01</span>
              <h4 className="text-[11px] font-bold text-cyan-400 tracking-wider">主体图片</h4>
            </div>
            
            <div 
              onClick={() => sourceInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if(f) processFile(f); }}
              className={`relative aspect-square rounded-[1.5rem] border-2 border-dashed flex items-center justify-center overflow-hidden transition-all group ${
                state.sourceImage ? 'border-cyan-500/30' : 'border-white/10 hover:border-cyan-500/30'
              }`}
            >
              {state.sourceImage ? (
                <img src={state.sourceImage} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform" />
              ) : (
                <div className="text-center opacity-20">
                  <div className="text-4xl mb-2">📸</div>
                  <p className="text-[10px] uppercase font-bold tracking-widest">点击或拖入主体</p>
                </div>
              )}
              <input type="file" ref={sourceInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} className="hidden" accept="image/*" />
            </div>
          </div>

          {/* Creativity Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center text-[10px] font-bold tracking-widest uppercase">
              <span className="text-slate-400">设计重构幅度 / CREATIVITY</span>
              <span className="text-cyan-400">{Math.round(state.intensity * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.01" 
              value={state.intensity} 
              onChange={(e) => setState(p => ({ ...p, intensity: parseFloat(e.target.value) }))}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" 
            />
            <div className="flex justify-between text-[8px] text-slate-600 font-bold uppercase tracking-widest">
              <span>微调</span>
              <span>标准</span>
              <span>彻底换皮</span>
            </div>
          </div>

          {/* Details Textarea */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">细节锁定 (OPTIONAL)</h4>
            <textarea 
              value={state.customPrompt}
              onChange={(e) => setState(p => ({ ...p, customPrompt: e.target.value }))}
              placeholder="例如: 墨镜, 拖鞋, 鱼, 戒指..."
              className="w-full h-24 bg-black/40 border border-white/5 rounded-2xl p-4 text-xs resize-none outline-none focus:border-cyan-500/30 transition-colors placeholder:text-slate-700"
            />
          </div>

          {/* Batch Selector */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">渲染序列长度</h4>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  onClick={() => setState(p => ({ ...p, generateCount: num }))}
                  className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                    state.generateCount === num ? 'bg-cyan-500 text-black border-cyan-500 shadow-lg shadow-cyan-500/20' : 'bg-slate-900 border-white/5 text-slate-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={startGeneration}
            disabled={!state.sourceImage || state.isGenerating}
            className={`w-full py-5 rounded-3xl font-bold text-sm tracking-widest uppercase transition-all shadow-xl ${
              !state.sourceImage || state.isGenerating
                ? 'bg-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white hover:scale-[1.02] active:scale-95 shadow-cyan-500/10'
            }`}
          >
            {state.isGenerating ? '正在渲染换皮变体...' : '启动渲染变体'}
          </button>
        </aside>

        {/* Right Viewport Area - Expanded (lg:col-span-9) */}
        <section className="lg:col-span-9 glass rounded-[3rem] p-4 md:p-8 min-h-[850px] flex flex-col items-center justify-center relative overflow-hidden border-white/5 shadow-inner">
          {!state.sourceImage && !state.isGenerating && state.results.length === 0 ? (
            <div className="text-center opacity-10 flex flex-col items-center">
              <div className="text-[12rem] mb-8">🖼️</div>
              <h2 className="text-5xl font-black uppercase tracking-tighter">Viewport Ready</h2>
              <p className="mt-6 text-xs font-bold tracking-[0.8em] uppercase">导入主体素材以开启四位一体渲染</p>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-10 items-center">
              {(state.isGenerating || state.results.length > 0) && state.results.map((res) => (
                <div key={res.id} className="relative w-full max-w-[1000px] group rounded-[2.5rem] bg-black/40 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-700 border border-white/5">
                  {res.status === 'loading' ? (
                    <div className="w-full aspect-square loading-shimmer flex flex-col items-center justify-center gap-8">
                      <div className="w-20 h-20 border-4 border-cyan-500/10 border-t-cyan-500 rounded-full animate-spin"></div>
                      <div className="text-center">
                        <span className="text-sm font-black text-cyan-400 uppercase tracking-[0.6em] animate-pulse">Synthesis Active</span>
                        <p className="text-[10px] text-slate-500 mt-3 uppercase tracking-widest font-bold">正在进行工业级单图渲染 4 组变体设计</p>
                      </div>
                    </div>
                  ) : res.status === 'success' ? (
                    <div className="w-full relative">
                       <img src={res.url} alt="Variant Concept Sheet" className="w-full h-auto block object-contain" />
                       <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-8 backdrop-blur-xl">
                          <div className="text-center">
                            <span className="text-sm font-black text-cyan-400 tracking-[0.8em] uppercase block mb-4">Variant Set Generated</span>
                            <span className="text-[10px] text-slate-300 uppercase tracking-widest font-bold italic">High Fidelity Rendering Complete</span>
                          </div>
                          <div className="flex gap-6">
                            <button 
                              onClick={() => handlePlaceHistoryItem(res.url)}
                              className="px-10 py-5 bg-cyan-500 text-black font-black text-[12px] uppercase rounded-full hover:bg-cyan-400 transition-all transform hover:scale-110 shadow-lg shadow-cyan-500/20"
                            >
                              再次放置为主体
                            </button>
                            <a href={res.url} download={`skinswap-set-${res.id}.png`} className="px-10 py-5 bg-white text-black font-black text-[12px] uppercase rounded-full hover:bg-slate-200 transition-all transform hover:scale-110">
                              保存渲染变体
                            </a>
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="py-40 text-red-500 text-xs font-black uppercase tracking-[0.4em] text-center">
                      <div className="text-5xl mb-6">⚠️</div>
                      渲染序列发生意外中断，请检查输入后重试
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* History Grid (Vault) */}
      <section className="max-w-[1400px] mx-auto mt-20 pb-20 px-4">
        <div className="flex justify-between items-end mb-10 border-b border-white/5 pb-8">
           <div className="flex items-center gap-5">
             <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest italic">资产存档库 (Vault)</h2>
             <span className="px-4 py-1.5 bg-white/5 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Saved: {state.history.length}</span>
           </div>
           <button 
             onClick={handleClearHistory}
             className="text-[10px] font-black text-slate-700 hover:text-red-900 uppercase transition-colors tracking-widest"
           >
             Flush Archives
           </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-5">
           {state.history.map(item => (
             <div key={item.id} className="relative aspect-square rounded-2xl overflow-hidden glass group border border-white/5">
                <img src={item.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" />
                <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4 backdrop-blur-sm">
                   <button 
                     onClick={() => handlePlaceHistoryItem(item.url)}
                     className="w-full py-2 bg-cyan-500 text-black rounded-xl text-[9px] font-black uppercase hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/10"
                   >
                     放置 (Reuse)
                   </button>
                   <a href={item.url} download={`skinswap-vault-${item.id}.png`} className="w-full py-2 bg-white text-black rounded-xl text-[9px] font-black uppercase text-center hover:bg-slate-200 transition-colors">
                     下载
                   </a>
                </div>
             </div>
           ))}
           {state.history.length === 0 && Array.from({length: 8}).map((_, i) => (
             <div key={i} className="aspect-square rounded-2xl border border-white/5 bg-white/2 opacity-10 border-dashed flex items-center justify-center">
                <span className="text-[9px] uppercase font-black text-slate-800 tracking-tighter">Empty Slot</span>
             </div>
           ))}
        </div>
      </section>

      <footer className="max-w-[1400px] mx-auto py-16 border-t border-white/5 flex flex-wrap justify-center gap-16 text-[10px] font-black uppercase tracking-[0.5em] text-slate-700">
         <span className="flex items-center gap-3"><span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span> 萍果AI Engine</span>
         <span className="flex items-center gap-3"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span> 4K Reskinning Studio</span>
         <span className="flex items-center gap-3"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Industrial Aesthetic Control</span>
      </footer>
    </div>
  );
};

export default App;