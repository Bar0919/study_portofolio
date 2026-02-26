import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Activity, ShieldCheck, Image as ImageIcon, Settings2, BarChart2, Layers, Dna, Zap } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import 'katex/dist/katex.min.css';

import { ALGORITHMS, THESIS_DEFAULTS } from './constants/data';
import { ImageInspector } from './components/ImageInspector';
import { ConfigPanel } from './components/ConfigPanel';
import { HistorySidebar } from './components/HistorySidebar';
import { InsightCard } from './components/InsightCard';
import { CompareCard } from './components/CompareCard';

ChartJS.defaults.color = '#94a3b8';
ChartJS.defaults.borderColor = '#1e293b';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const getBaselineMetrics = (metrics: any[]) => ({
  psnr: metrics.length > 0 ? metrics[0].psnr : 0,
  ssim: metrics.length > 0 ? metrics[0].ssim : 0
});

const App: React.FC = () => {
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [interactionMode, setInteractionMode] = useState<'slider' | 'zoom'>('slider');
  const [heatmapInteractionMode, setHeatmapInteractionMode] = useState<'slider' | 'zoom'>('slider');
  const [algorithm, setAlgorithm] = useState('LC-MRF');
  const [sampleImg, setSampleImg] = useState('Aerial');
  const [noiseSigma, setNoiseSigma] = useState<number>(10);
  
  const [allParams, setAllParams] = useState<Record<string, any>>(() => JSON.parse(JSON.stringify(THESIS_DEFAULTS)));
  const [autoFlags, setAutoFlags] = useState<Record<string, boolean>>(ALGORITHMS.reduce((acc, alg) => ({ ...acc, [alg]: true }), {}));

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [workerReady, setWorkerReady] = useState(false);
  
  const [noisyUrl, setNoisyUrl] = useState<string>('');
  const [denoisedUrl, setDenoisedUrl] = useState<string>('');
  const [heatmapUrl, setHeatmapUrl] = useState<string>('');
  const [initialHeatmapUrl, setInitialHeatmapUrl] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [compareResults, setCompareResults] = useState<Record<string, { url: string, heatmapUrl: string, psnr: number, ssim: number, time: number }>>({});

  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalDataRef = useRef<Uint8Array | null>(null);
  const noisyDataRef = useRef<Uint8Array | null>(null);

  const renderResult = (data: Uint8Array, setter: (url: string) => void, isHeatmap = false) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(256, 256);
    if (isHeatmap) {
      imgData.data.set(data);
    } else {
      for (let i = 0; i < data.length; i++) {
        imgData.data[i*4] = imgData.data[i*4+1] = imgData.data[i*4+2] = data[i];
        imgData.data[i*4+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    setter(canvas.toDataURL('image/png'));
  };

  useEffect(() => {
    workerRef.current = new Worker(new URL('./workers/denoise.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e) => {
      const { type, data, heatmap, algorithm: resAlg, executionTime, image } = e.data;
      
      if (type === 'initialized') setWorkerReady(true);
      else if (type === 'aborted') setIsProcessing(false);
      else if (type === 'initial_heatmap') {
        renderResult(e.data.heatmap, setInitialHeatmapUrl, true);
      }
      else if (type === 'progress') {
        setMetrics(prev => [...prev, data]);
        setProgress(Math.round((data.iteration / (allParams[algorithm].max_iter || 50)) * 100));
        if (image && mode === 'single') renderResult(image, setDenoisedUrl);
      } else if (type === 'done') {
        if (mode === 'single') {
          renderResult(data, setDenoisedUrl);
          if (heatmap) renderResult(heatmap, setHeatmapUrl, true);
          setHistory(prev => [{
            id: Date.now(), timestamp: new Date().toLocaleTimeString(), algorithm: resAlg || algorithm,
            sigma: noiseSigma, psnr: e.data.finalPsnr || 0, ssim: e.data.finalSsim || 0,
            time: executionTime, params: { ...allParams[resAlg || algorithm] }
          }, ...prev].slice(0, 10));
          setIsProcessing(false);
        } else {
          const resCanvas = document.createElement('canvas'); resCanvas.width = 256; resCanvas.height = 256;
          const resCtx = resCanvas.getContext('2d')!; const resImgData = resCtx.createImageData(256, 256);
          for (let i = 0; i < data.length; i++) { resImgData.data[i*4] = resImgData.data[i*4+1] = resImgData.data[i*4+2] = data[i]; resImgData.data[i*4+3] = 255; }
          resCtx.putImageData(resImgData, 0, 0);
          
          const hmCanvas = document.createElement('canvas'); hmCanvas.width = 256; hmCanvas.height = 256;
          const hmCtx = hmCanvas.getContext('2d')!; const hmImgData = hmCtx.createImageData(256, 256);
          hmImgData.data.set(heatmap); hmCtx.putImageData(hmImgData, 0, 0);
          
          setCompareResults(prev => {
            const next = { ...prev, [resAlg]: { url: resCanvas.toDataURL('image/png'), heatmapUrl: hmCanvas.toDataURL('image/png'), psnr: e.data.finalPsnr || 0, ssim: e.data.finalSsim || 0, time: executionTime } };
            if (Object.keys(next).length === ALGORITHMS.length) setIsProcessing(false);
            return next;
          });
        }
      }
    };
    workerRef.current.postMessage({ type: 'init', data: { width: 256, height: 256 } });
    return () => workerRef.current?.terminate();
  }, [mode, allParams]);

  const generateNoisyImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !originalDataRef.current) return;
    const original = originalDataRef.current;
    const noisy = new Uint8Array(256 * 256);
    const ctx = canvas.getContext('2d')!;
    
    for (let i = 0; i < original.length; i++) {
      const gray = original[i];
      const noise = Math.sqrt(-2.0 * Math.log(Math.random()+1e-10)) * Math.cos(2.0 * Math.PI * Math.random()) * noiseSigma;
      noisy[i] = Math.min(255, Math.max(0, Math.round(gray + noise)));
    }
    
    noisyDataRef.current = noisy;
    const noisyImgData = ctx.createImageData(256, 256);
    for (let i = 0; i < noisy.length; i++) {
      noisyImgData.data[i*4] = noisyImgData.data[i*4+1] = noisyImgData.data[i*4+2] = noisy[i];
      noisyImgData.data[i*4+3] = 255;
    }
    ctx.putImageData(noisyImgData, 0, 0);
    setNoisyUrl(canvas.toDataURL('image/png'));
    return noisy;
  };

  useEffect(() => {
    const img = new Image();
    img.src = `/samples/${sampleImg}.bmp`;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      canvas.width = 256; canvas.height = 256;
      ctx.drawImage(img, 0, 0, 256, 256);
      const imgData = ctx.getImageData(0, 0, 256, 256).data;
      const original = new Uint8Array(256 * 256);
      for (let i = 0; i < imgData.length; i += 4) {
        original[i / 4] = Math.round(0.299 * imgData[i] + 0.587 * imgData[i+1] + 0.114 * imgData[i+2]);
      }
      originalDataRef.current = original;
      
      generateNoisyImage();
      setDenoisedUrl(canvas.toDataURL('image/png'));
      setHeatmapUrl('');
      setInitialHeatmapUrl('');
      setCompareResults({});
      setMetrics([]);
    };
  }, [sampleImg, noiseSigma]);

  const runSingle = () => {
    if (!workerReady || isProcessing) return;
    setIsProcessing(true); setMetrics([]); setProgress(0);
    workerRef.current?.postMessage({ type: 'run', data: { algorithm, params: allParams[algorithm], mode: 'single', originalImage: originalDataRef.current, noisyImage: generateNoisyImage() } });
  };

  const runCompare = () => {
    if (!workerReady || isProcessing) return;
    setCompareResults({}); setIsProcessing(true);
    const currentNoisy = generateNoisyImage();
    ALGORITHMS.forEach(alg => {
      workerRef.current?.postMessage({ type: 'run', data: { algorithm: alg, params: allParams[alg], mode: 'compare', originalImage: originalDataRef.current, noisyImage: currentNoisy } });
    });
  };

  const updateParam = (alg: string, key: string, val: any) => {
    setAllParams(prev => ({ ...prev, [alg]: { ...prev[alg], [key]: val } }));
  };

  const toggleAuto = (alg: string) => {
    const newVal = !autoFlags[alg];
    setAutoFlags(prev => ({ ...prev, [alg]: newVal }));
    if (newVal) {
      const defaults = JSON.parse(JSON.stringify(THESIS_DEFAULTS[alg]));
      if (alg === 'rTV-MRF') defaults.sigma_sq = noiseSigma * noiseSigma;
      setAllParams(prev => ({ ...prev, [alg]: defaults }));
    }
  };

  useEffect(() => {
    // ノイズ強度が変わった際、rTV-MRFのみ初期値を同期させる
    if (autoFlags['rTV-MRF']) {
      setAllParams(prev => ({
        ...prev,
        'rTV-MRF': { 
          ...prev['rTV-MRF'], 
          sigma_sq: noiseSigma * noiseSigma 
        }
      }));
    }
  }, [noiseSigma, autoFlags['rTV-MRF']]);

  const psnrChartData = useMemo(() => {
    const { psnr: baselinePsnr } = getBaselineMetrics(metrics);
    return {
      labels: metrics.map(m => m.step),
      datasets: [
        { label: 'PSNR (dB)', data: metrics.map(m => m.psnr), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 },
        { label: 'Baseline', data: metrics.map(() => baselinePsnr), borderColor: '#ef4444', borderDash: [5, 5], pointRadius: 0 }
      ]
    };
  }, [metrics]);

  const ssimChartData = useMemo(() => {
    const { ssim: baselineSsim } = getBaselineMetrics(metrics);
    return {
      labels: metrics.map(m => m.step),
      datasets: [
        { label: 'SSIM', data: metrics.map(m => m.ssim), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
        { label: 'Baseline', data: metrics.map(() => baselineSsim), borderColor: '#f59e0b', borderDash: [5, 5], pointRadius: 0 }
      ]
    };
  }, [metrics]);

  const bestAlg = useMemo(() => Object.entries(compareResults).sort((a, b) => b[1].ssim - a[1].ssim)[0]?.[0] || '', [compareResults]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      <canvas ref={canvasRef} className="hidden" />
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600 rounded-full blur-[120px] animate-pulse delay-700"></div>
      </div>

      <div className={`max-w-[1800px] mx-auto p-4 md:p-8 grid grid-cols-1 ${mode === 'single' ? 'xl:grid-cols-[380px_1fr_320px]' : 'xl:grid-cols-[380px_1fr]'} gap-8 relative z-10`}>
        <aside className="space-y-6">
          <header className="bg-slate-900/80 backdrop-blur-2xl p-8 rounded-[2rem] border border-slate-800 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/40 transform rotate-12"><Dna className="text-white" size={32} /></div>
              <div><h1 className="text-2xl font-black tracking-tight text-white leading-none">MRF Engine</h1><p className="text-blue-400 text-xs font-black uppercase tracking-[0.2em] mt-1">Research Portfolio</p></div>
            </div>
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800/50">
              <button onClick={() => setMode('single')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${mode === 'single' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500'}`}><Zap size={16} /> SINGLE</button>
              <button onClick={() => setMode('compare')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${mode === 'compare' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500'}`}><BarChart2 size={16} /> COMPARE</button>
            </div>
          </header>

          <section className="bg-slate-900/80 backdrop-blur-2xl p-8 rounded-[2rem] border border-slate-800 shadow-2xl space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest"><ImageIcon size={14} /> Environment</div>
              <div className="grid grid-cols-3 gap-2">
                {['Aerial', 'Clock', 'WOMAN'].map(img => (
                  <button key={img} onClick={() => setSampleImg(img)} className={`py-3 rounded-xl text-sm font-black transition-all border ${sampleImg === img ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{img}</button>
                ))}
              </div>
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/50 space-y-3">
                <div className="flex justify-between items-center"><span className="text-xs font-black text-rose-400 uppercase tracking-widest">Noise σ</span><span className="text-base font-mono font-bold text-white">{noiseSigma}</span></div>
                <input type="range" min="1" max="50" value={noiseSigma} onChange={(e) => setNoiseSigma(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500" />
              </div>
            </div>

            {mode === 'single' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest">
                  <Settings2 size={14} /> Methodology
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ALGORITHMS.map(alg => (
                    <button 
                      key={alg} onClick={() => setAlgorithm(alg)} 
                      className={`relative py-3 rounded-xl text-sm font-black transition-all border ${algorithm === alg ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                    >
                      {alg}
                      {alg === 'HGMRF' && <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-slate-700 text-white text-[10px] font-black rounded-md border border-slate-600 shadow-lg">B</span>}
                      {(alg === 'rTV-MRF' || alg === 'LC-MRF') && <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-md border border-blue-500 shadow-lg">M</span>}
                    </button>
                  ))}
                </div>
                <ConfigPanel 
                  algorithm={algorithm} 
                  params={allParams[algorithm]} 
                  isAuto={autoFlags[algorithm]} 
                  onParamChange={(k, v) => updateParam(algorithm, k, v)} 
                  onToggleAuto={() => toggleAuto(algorithm)} 
                />
              </div>
            )}

            <button 
              onClick={isProcessing ? undefined : (mode === 'single' ? runSingle : runCompare)} 
              disabled={isProcessing}
              className={`w-full h-20 rounded-3xl transition-all transform ${!isProcessing && 'active:scale-95 shadow-2xl'} relative overflow-hidden group font-black text-xl tracking-tight ${isProcessing ? 'cursor-wait' : 'cursor-pointer'}`}
            >
              <div className={`absolute inset-0 transition-all ${isProcessing ? 'bg-emerald-900/40 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'}`}></div>
              {isProcessing && <div className="absolute left-0 top-0 h-full bg-emerald-500 opacity-20 transition-all duration-300" style={{ width: `${progress}%` }}></div>}
              <div className="relative z-10 flex flex-col items-center justify-center text-white">
                <div className="flex items-center gap-3">
                  {isProcessing ? <Activity size={24} className="animate-spin" /> : <Play fill="currentColor" />}
                  {isProcessing ? `PROCESSING (${progress}%)` : 'EXECUTE ENGINE'}
                </div>
                {isProcessing && metrics.length > 0 && <span className="text-xs font-black uppercase tracking-[0.3em] mt-1 text-emerald-200 animate-pulse">{metrics[metrics.length - 1].task || 'CALCULATING'}</span>}
              </div>
            </button>
          </section>
        </aside>

        <main className="space-y-8">
          {mode === 'single' ? (
            <div className="animate-in fade-in slide-in-from-right-8 duration-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black tracking-tight flex items-center gap-3"><Activity size={20} className="text-blue-500" /> RECOVERY FLOW</h3>
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button onClick={() => setInteractionMode('slider')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${interactionMode === 'slider' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>Compare</button>
                      <button onClick={() => setInteractionMode('zoom')} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${interactionMode === 'zoom' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>Lens Zoom</button>
                    </div>
                  </div>
                  <div className="relative rounded-3xl border border-slate-800 overflow-hidden aspect-square bg-slate-950">
                    <ImageInspector isEnabled={interactionMode === 'zoom'} zoomImage={denoisedUrl}>
                      <ReactCompareSlider 
                        itemOne={<div className="relative h-full w-full"><ReactCompareSliderImage src={noisyUrl} alt="Noisy" /><div className="absolute top-6 left-6 bg-slate-900/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 text-[10px] font-black uppercase text-white">Noisy Input</div></div>} 
                        itemTwo={<div className="relative h-full w-full"><ReactCompareSliderImage src={denoisedUrl} alt="Restored" /><div className="absolute top-6 right-6 bg-blue-600/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 text-[10px] font-black uppercase text-white">Restored Result</div></div>} 
                      />
                    </ImageInspector>
                  </div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black tracking-tight flex items-center gap-3"><ShieldCheck size={20} className="text-emerald-500" /> ERROR LOCALITY</h3>
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button 
                        onClick={() => setHeatmapInteractionMode('slider')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${heatmapInteractionMode === 'slider' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}
                      >
                        Compare
                      </button>
                      <button 
                        onClick={() => setHeatmapInteractionMode('zoom')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${heatmapInteractionMode === 'zoom' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}
                      >
                        Lens Zoom
                      </button>
                    </div>
                  </div>
                  <div className="relative rounded-3xl border border-slate-800 overflow-hidden aspect-square bg-slate-950 group">
                    {heatmapUrl ? (
                      <ImageInspector isEnabled={heatmapInteractionMode === 'zoom'} zoomImage={heatmapUrl}>
                        <ReactCompareSlider itemOne={<div className="relative h-full w-full"><ReactCompareSliderImage src={initialHeatmapUrl || noisyUrl} alt="Initial" /><div className="absolute top-6 left-6 bg-slate-900/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 text-[10px] font-black uppercase text-white">Initial State</div></div>} itemTwo={<div className="relative h-full w-full"><ReactCompareSliderImage src={heatmapUrl} alt="Final" /><div className="absolute top-6 right-6 bg-emerald-600/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 text-[10px] font-black uppercase text-white">Final Quality</div></div>} />
                      </ImageInspector>
                    ) : <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-slate-900/40 backdrop-blur-md"><Activity size={48} className="text-slate-700 animate-pulse" /><span className="text-xs font-black text-slate-500 uppercase tracking-widest">Waiting for Calculation...</span></div>}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 border-b border-slate-800 pb-8 mb-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">PSNR: Peak Signal-to-Noise Ratio (dB)</h4>
                    <div className="h-[200px]">
                      <Line 
                        data={psnrChartData} 
                        options={{ 
                          responsive: true, 
                          maintainAspectRatio: false, 
                          scales: { 
                            x: { title: { display: true, text: 'Step', color: '#475569', font: { size: 12, weight: 'bold' } }, grid: { display: false } }, 
                            y: { title: { display: true, text: 'PSNR (dB)', color: '#475569', font: { size: 12, weight: 'bold' } }, grid: { color: '#1e293b' } } 
                          }, 
                          plugins: { legend: { display: false } } 
                        }} 
                      />
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed italic">
                      <strong className="text-blue-400 not-italic">PSNR:</strong> 画像全体のピクセル値のズレを「平均的」に評価します。一部の極端な劣化よりも、全体としてのデータの正しさを厳格に測るために用います。
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">SSIM: Structural Similarity Index Measure</h4>
                    <div className="h-[200px]">
                      <Line 
                        data={ssimChartData} 
                        options={{ 
                          responsive: true, 
                          maintainAspectRatio: false, 
                          scales: { 
                            x: { title: { display: true, text: 'Step', color: '#475569', font: { size: 12, weight: 'bold' } }, grid: { display: false } }, 
                            y: { title: { display: true, text: 'SSIM', color: '#475569', font: { size: 12, weight: 'bold' } }, grid: { color: '#1e293b' } } 
                          }, 
                          plugins: { legend: { display: false } } 
                        }} 
                      />
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed italic">
                      <strong className="text-emerald-400 not-italic">SSIM:</strong> 領域ごとの「輪郭や模様」の維持度を評価します。全体のズレが小さくても、大切なエッジがボケていないかなど、視覚的な品質を担保するために併用します。
                    </p>
                  </div>
                </div>
                <InsightCard algorithm={algorithm} />
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black tracking-tight flex items-center gap-3"><Layers size={24} className="text-blue-500" /> ENSEMBLE COMPARISON</h3><div className="px-4 py-2 bg-slate-950 rounded-2xl border border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">Parallel Benchmark</div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                  {ALGORITHMS.map(alg => (
                    <CompareCard 
                      key={alg}
                      alg={alg}
                      result={compareResults[alg]}
                      isWinner={alg === bestAlg}
                      params={allParams[alg]}
                      isAuto={autoFlags[alg]}
                      onParamChange={(k, v) => updateParam(alg, k, v)}
                      onToggleAuto={() => toggleAuto(alg)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
        
        {mode === 'single' && <HistorySidebar history={history} onClear={() => setHistory([])} />}
      </div>
    </div>
  );
};

export default App;
