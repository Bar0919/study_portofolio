import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, Activity, ShieldCheck, Award, BookOpen, 
  Image as ImageIcon, Settings2, BarChart2, Crown, 
  Timer, Square, Info, ChevronRight, Layers, 
  Dna, Zap, AlertCircle
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, 
  PointElement, LineElement, BarElement, Title, 
  Tooltip, Legend, Filler 
} from 'chart.js';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';

// --- Chart Configuration ---
ChartJS.defaults.color = '#94a3b8';
ChartJS.defaults.borderColor = '#1e293b';
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, Filler
);

// --- Research Narrative metadata ---
const ALGORITHM_METADATA: Record<string, { 
  name: string, 
  tagline: string, 
  desc: string, 
  math: string,
  problem: string,
  solution: string,
  challenge: string
}> = {
  'GMRF': { 
    name: 'GMRF',
    tagline: 'Gaussian Markov Random Field',
    desc: '平滑化関数に「差の二乗誤差」を用いており、数学的処理（多次元ガウス分布）が非常に扱いやすく、近似計算なしで高速な計算が可能です。', 
    problem: '空間的平滑性が強すぎるため、ピクセル値の差が大きい「エッジ」のような外れ値を許容できず、過剰な平滑化によって画像構造がぼやけてしまう。',
    solution: '二乗誤差の代わりに、外れ値を許容してエッジを残せる「絶対値誤差」を用いた平滑化手法（TV正則化）を導入する。',
    challenge: '非等方的な平滑化が困難であり、細部やテクスチャの保存に限界がある。',
    math: 'E_{\\mathrm{GMRF}}(\\bm{x}) = \\frac{\\lambda}{2}\\sum_{i \\in V} x_i^2 + \\frac{\\alpha}{2}\\sum_{\\{i,j\\} \\in E} (x_i - x_j)^2' 
  },
  'HGMRF': { 
    name: 'HGMRF',
    tagline: 'Hierarchical GMRF',
    desc: 'GMRFのバイアス問題を事前分布の周辺化で解決した階層型モデル。尤度ピーク検出による自動停止機能を備えます。', 
    problem: '入力画像に含まれる未知のバイアス成分が、MAP推定の精度を低下させる。',
    solution: 'バイアス成分を数学的に周辺化し、周辺対数尤度の移動平均のピークで計算を打ち切る提案手法。',
    challenge: 'ガウス性を前提としているため、極端な非ガウスノイズに対しては強みが薄れる。',
    math: 'E_{\\mathrm{HGMRF}}(\\bm{x}) = \\frac{1}{2}\\bm{x}^t \\bm{H}_{\\mathrm{pri}} \\bm{x}' 
  },
  'rTV-MRF': { 
    name: 'rTV-MRF',
    tagline: 'Relaxed TV-MRF',
    desc: 'Diracのデルタ関数をガウス分布で近似緩和したことで、扱いやすい条件付き分布による交互確率最大化が可能となったモデル。', 
    problem: '絶対値関数は微分不可能な点を持ち、隣接ピクセル間の複雑な相互作用を生むため、直接の最適化が困難。',
    solution: '補助変数と緩和パラメータを導入したSplit Bregman法により、エッジ保存と計算の実行可能性を両立。',
    challenge: '高次元の補助変数を追加した代償として、反復ごとの計算コストが非常に重い。',
    math: 'E_{\\mathrm{TV}}(\\bm{x}) = \\frac{\\lambda}{2}\\sum_{i \\in V} x_i^2 + \\alpha \\sum_{\\{i,j\\} \\in E} |x_i - x_j|' 
  },
  'LC-MRF': { 
    name: 'LC-MRF',
    tagline: 'Log-Cosh MRF (Proposed)',
    desc: '平滑化関数に「ln cosh関数」を採用した最終提案モデル。エッジ保持と計算の容易さを高次元で両立しました。', 
    problem: 'ノイズ除去性能はスケーリングパラメータ s の値に大きく依存し、画像構造に合わせて最適な s が変動する。',
    solution: 'ln cosh関数が全域で微分可能であることを利用し、補助変数なしでの高速なMAP推定と、MCMCによるパラメータ推定を統合。',
    challenge: '原画像が未知の実際の環境において、この最適なスケーリングパラメータ s を自動的に探索・調整する手法の確立が次なる課題。',
    math: 'E_{\\mathrm{LC}}(\\bm{x}) = \\frac{\\lambda}{2}\\sum_{i \\in V} x_i^2 + \\alpha \\sum_{\\{i,j\\} \\in E} \\ln\\cosh(s(x_i - x_j))' 
  }
};

const PARAM_HELP: Record<string, string> = {
  'lambda': '精度行列の対角成分 (λ)。',
  'alpha': '隣接ピクセル間の平滑化強度 (α)。',
  'sigma_sq': '観測ノイズの推定分散 (σ²)。',
  'gamma_sq': 'HGMRF/rTV-MRFの補助変数緩和パラメータ (γ²)。',
  's': 'LC-MRFの活性化鋭度 (s)。',
  'max_iter': '最大反復回数 (Iterations)。',
  'epsilon_map': 'MAP推定の更新ステップ幅 (ε_map)。',
  'epsilon_pri': '事前分布サンプリングの歩幅 (ε_pri)。',
  'epsilon_post': '事後分布サンプリングの歩幅 (ε_post)。',
  'eta_lambda': 'λ の学習率 (η_λ)。',
  'eta_alpha': 'α の学習率 (η_α)。',
  'eta_sigma2': 'σ² の学習率 (η_σ²)。',
  'eta_gamma2': 'γ² の学習率 (η_γ²)。',
  'is_learning': '最尤推定によるパラメータ自動最適化の有無。'
};

const THESIS_DEFAULTS: Record<string, any> = {
  'GMRF': { 
    lambda: 1e-7, alpha: 1e-4, sigma_sq: 1000.0, max_iter: 50, is_learning: true,
    eta_lambda: 1e-12, eta_alpha: 5e-7
  },
  'HGMRF': { 
    lambda: 1e-7, alpha: 1e-4, sigma_sq: 1000.0, gamma_sq: 1e-3, max_iter: 100, is_learning: true,
    eta_lambda: 1e-12, eta_alpha: 5e-8, eta_gamma2: 5e-8
  },
  'rTV-MRF': { 
    lambda: 1e-7, alpha: 0.5, sigma_sq: 100.0, max_iter: 50, is_learning: false
  },
  'LC-MRF': { 
    lambda: 1e-7, alpha: 5e-3, sigma_sq: 10.0, s: 30.0, max_iter: 50, is_learning: true,
    epsilon_map: 1.0, epsilon_pri: 1e-4, epsilon_post: 1e-4, 
    eta_lambda: 1e-14, eta_alpha: 5e-8, eta_sigma2: 1.0,
    n_pri: 5, n_post: 5, t_hat_max: 10, t_dot_max: 10
  }
};

const ALGORITHMS = ['GMRF', 'HGMRF', 'rTV-MRF', 'LC-MRF'];

const getBaselineMetrics = (metrics: any[]) => ({
  psnr: metrics.length > 0 ? metrics[0].psnr : 0,
  ssim: metrics.length > 0 ? metrics[0].ssim : 0
});

const generateGaussianNoise = (stdDev: number) => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdDev;
};

const App: React.FC = () => {
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [algorithm, setAlgorithm] = useState('LC-MRF');
  const [sampleImg, setSampleImg] = useState('Aerial');
  const [noiseSigma, setNoiseSigma] = useState<number>(10);
  const [isAutoParams, setIsAutoParams] = useState(true);
  
  const [params, setParams] = useState(THESIS_DEFAULTS['LC-MRF']);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [workerReady, setWorkerReady] = useState(false);
  
  const [noisyUrl, setNoisyUrl] = useState<string>('');
  const [denoisedUrl, setDenoisedUrl] = useState<string>('');
  const [heatmapUrl, setHeatmapUrl] = useState<string>('');
  const [initialHeatmapUrl, setInitialHeatmapUrl] = useState<string>('');
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
        setProgress(Math.round((data.iteration / (params.max_iter || 50)) * 100));
        if (image && mode === 'single') renderResult(image, setDenoisedUrl);
      } else if (type === 'done') {
        if (mode === 'single') {
          renderResult(data, setDenoisedUrl);
          if (heatmap) renderResult(heatmap, setHeatmapUrl, true);
          setIsProcessing(false);
        } else {
          const resCanvas = document.createElement('canvas');
          resCanvas.width = 256; resCanvas.height = 256;
          const resCtx = resCanvas.getContext('2d')!;
          const resImgData = resCtx.createImageData(256, 256);
          for (let i = 0; i < data.length; i++) {
            resImgData.data[i*4] = resImgData.data[i*4+1] = resImgData.data[i*4+2] = data[i];
            resImgData.data[i*4+3] = 255;
          }
          resCtx.putImageData(resImgData, 0, 0);
          const hmCanvas = document.createElement('canvas');
          hmCanvas.width = 256; hmCanvas.height = 256;
          const hmCtx = hmCanvas.getContext('2d')!;
          const hmImgData = hmCtx.createImageData(256, 256);
          hmImgData.data.set(heatmap);
          hmCtx.putImageData(hmImgData, 0, 0);
          setCompareResults(prev => ({
            ...prev,
            [resAlg]: { url: resCanvas.toDataURL('image/png'), heatmapUrl: hmCanvas.toDataURL('image/png'), psnr: e.data.finalPsnr || 0, ssim: e.data.finalSsim || 0, time: executionTime }
          }));
          if (Object.keys(compareResults).length + 1 === ALGORITHMS.length) setIsProcessing(false);
        }
      }
    };
    workerRef.current.postMessage({ type: 'init', data: { width: 256, height: 256 } });
    return () => workerRef.current?.terminate();
  }, [mode, params.max_iter]);

  useEffect(() => {
    if (isAutoParams) setParams(THESIS_DEFAULTS[algorithm]);
  }, [algorithm, isAutoParams]);

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
      const noisy = new Uint8Array(256 * 256);
      for (let i = 0; i < imgData.length; i += 4) {
        const gray = 0.299 * imgData[i] + 0.587 * imgData[i+1] + 0.114 * imgData[i+2];
        const idx = i / 4;
        original[idx] = Math.round(gray);
        const noise = Math.sqrt(-2.0 * Math.log(Math.random()+1e-10)) * Math.cos(2.0 * Math.PI * Math.random()) * noiseSigma;
        noisy[idx] = Math.min(255, Math.max(0, Math.round(gray + noise)));
      }
      originalDataRef.current = original;
      noisyDataRef.current = noisy;
      const noisyImgData = ctx.createImageData(256, 256);
      for (let i = 0; i < noisy.length; i++) {
        noisyImgData.data[i*4] = noisyImgData.data[i*4+1] = noisyImgData.data[i*4+2] = noisy[i];
        noisyImgData.data[i*4+3] = 255;
      }
      ctx.putImageData(noisyImgData, 0, 0);
      setNoisyUrl(canvas.toDataURL('image/png'));
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
    workerRef.current?.postMessage({ type: 'run', data: { algorithm, params, mode: 'single', originalImage: originalDataRef.current, noisyImage: noisyDataRef.current } });
  };

  const runCompare = () => {
    if (!workerReady || isProcessing) return;
    setCompareResults({}); setIsProcessing(true);
    ALGORITHMS.forEach(alg => {
      workerRef.current?.postMessage({ type: 'run', data: { algorithm: alg, params: THESIS_DEFAULTS[alg], mode: 'compare', originalImage: originalDataRef.current, noisyImage: noisyDataRef.current } });
    });
  };

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

      <div className="max-w-[1600px] mx-auto p-4 md:p-8 grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-8 relative z-10">
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
              <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><ImageIcon size={14} /> Environment</div>
              <div className="grid grid-cols-3 gap-2">
                {['Aerial', 'Clock', 'WOMAN'].map(img => (
                  <button key={img} onClick={() => setSampleImg(img)} className={`py-3 rounded-xl text-xs font-black transition-all border ${sampleImg === img ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{img}</button>
                ))}
              </div>
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/50 space-y-3">
                <div className="flex justify-between items-center"><span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Noise σ</span><span className="text-sm font-mono font-bold text-white">{noiseSigma}</span></div>
                <input type="range" min="1" max="50" value={noiseSigma} onChange={(e) => setNoiseSigma(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500" />
              </div>
            </div>

            {mode === 'single' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest"><Settings2 size={14} /> Methodology</div>
                <div className="grid grid-cols-2 gap-2">
                  {ALGORITHMS.map(alg => (
                    <button key={alg} onClick={() => setAlgorithm(alg)} className={`py-3 rounded-xl text-xs font-black transition-all border ${algorithm === alg ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{alg}</button>
                  ))}
                </div>
                <div className="pt-4 border-t border-slate-800/50 space-y-4">
                  <div className="flex items-center justify-between"><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Configuration</span><button onClick={() => setIsAutoParams(!isAutoParams)} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${isAutoParams ? 'bg-blue-600/20 text-blue-400' : 'bg-amber-600/20 text-amber-400'}`}>{isAutoParams ? 'Thesis Defaults' : 'Manual Tuning'}</button></div>
                  {!isAutoParams && (
                    <div className="space-y-6 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                      <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800"><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MLE Optimization</div><button onClick={() => setParams({...params, is_learning: !params.is_learning})} className={`w-10 h-5 rounded-full transition-all relative ${params.is_learning ? 'bg-emerald-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${params.is_learning ? 'left-6' : 'left-1'}`}></div></button></div>
                      {Object.keys(params).filter(k => k !== 'is_learning').map(key => (
                        <div key={key} className="space-y-2 group"><div className="flex justify-between"><label className="text-[10px] font-black text-slate-500 uppercase">{key}</label><span className="text-[10px] font-mono text-blue-400">{params[key]}</span></div><input type="number" step="0.0000001" value={params[key]} onChange={(e) => setParams({...params, [key]: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 transition-all" /><p className="text-[9px] text-slate-600 italic group-hover:text-slate-400">{PARAM_HELP[key]}</p></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <button 
              onClick={isProcessing ? undefined : (mode === 'single' ? runSingle : runCompare)} 
              disabled={isProcessing}
              className={`w-full h-20 rounded-3xl transition-all transform ${!isProcessing && 'active:scale-95 shadow-2xl'} relative overflow-hidden group font-black text-xl tracking-tight ${isProcessing ? 'cursor-wait' : 'cursor-pointer'}`}
            >
              <div className={`absolute inset-0 transition-all ${isProcessing ? 'bg-emerald-900/40 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'}`}></div>
              {isProcessing && (
                <div className="absolute left-0 top-0 h-full bg-emerald-500 opacity-20 transition-all duration-300" style={{ width: `${progress}%` }}></div>
              )}
              <div className="relative z-10 flex flex-col items-center justify-center text-white">
                <div className="flex items-center gap-3">
                  {isProcessing ? <Activity size={24} className="animate-spin" /> : <Play fill="currentColor" />}
                  {isProcessing ? `PROCESSING (${progress}%)` : 'EXECUTE ENGINE'}
                </div>
                {isProcessing && metrics.length > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] mt-1 text-emerald-200 animate-pulse">
                    {metrics[metrics.length - 1].task || 'CALCULATING'}
                  </span>
                )}
              </div>
            </button>
          </section>
        </aside>

        <main className="space-y-8">
          {mode === 'single' ? (
            <div className="animate-in fade-in slide-in-from-right-8 duration-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between"><h3 className="text-lg font-black tracking-tight flex items-center gap-3"><Activity size={20} className="text-blue-500" /> RECOVERY FLOW</h3><div className="flex items-center gap-4"><div className="text-center"><div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PSNR</div><div className="text-lg font-mono font-bold text-blue-400">{metrics.length > 0 ? metrics[metrics.length-1].psnr.toFixed(2) : '0.00'}<span className="text-[10px] ml-1">dB</span></div></div><div className="text-center border-l border-slate-800 pl-4"><div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SSIM</div><div className="text-lg font-mono font-bold text-emerald-400">{metrics.length > 0 ? metrics[metrics.length-1].ssim.toFixed(4) : '.0000'}</div></div></div></div>
                  <div className="relative rounded-3xl border border-slate-800 overflow-hidden aspect-square bg-slate-950">
                    <ReactCompareSlider itemOne={<div className="relative h-full w-full"><ReactCompareSliderImage src={noisyUrl} alt="Noisy" /><div className="absolute top-6 left-6 bg-slate-900/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 text-[10px] font-black uppercase text-white">Noisy Input</div></div>} itemTwo={<div className="relative h-full w-full"><ReactCompareSliderImage src={denoisedUrl} alt="Restored" /><div className="absolute top-6 right-6 bg-blue-600/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 text-[10px] font-black uppercase text-white">Restored Result</div></div>} />
                  </div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-3"><ShieldCheck size={20} className="text-emerald-500" /> ERROR LOCALITY</h3>
                  <div className="relative rounded-3xl border border-slate-800 overflow-hidden aspect-square bg-slate-950 group">
                    {heatmapUrl ? <ReactCompareSlider itemOne={<div className="relative h-full w-full"><ReactCompareSliderImage src={initialHeatmapUrl || noisyUrl} alt="Initial" /><div className="absolute top-6 left-6 bg-slate-900/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 text-[10px] font-black uppercase text-white">Initial State</div></div>} itemTwo={<div className="relative h-full w-full"><ReactCompareSliderImage src={heatmapUrl} alt="Final" /><div className="absolute top-6 right-6 bg-emerald-600/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 text-[10px] font-black uppercase text-white">Final Quality</div></div>} /> : <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-slate-900/40 backdrop-blur-md"><Activity size={48} className="text-slate-700 animate-pulse" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Waiting for Calculation...</span></div>}
                  </div>
                  <div className="flex justify-center gap-8 py-2"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-600"></div><span className="text-[10px] font-black text-slate-500 uppercase">Residual Noise</span></div><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600"></div><span className="text-[10px] font-black text-slate-500 uppercase">Structural Match</span></div></div>
                </div>
              </div>

              <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 border-b border-slate-800 pb-8 mb-8">
                  <div className="space-y-4"><h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">PSNR Convergence Curve (dB)</h4><div className="h-[200px]"><Line data={psnrChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'Step', color: '#475569', font: { size: 10, weight: 'bold' } }, grid: { display: false } }, y: { grid: { color: '#1e293b' } } }, plugins: { legend: { display: false } } }} /></div></div>
                  <div className="space-y-4"><h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">SSIM Convergence Curve</h4><div className="h-[200px]"><Line data={ssimChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'Step', color: '#475569', font: { size: 10, weight: 'bold' } }, grid: { display: false } }, y: { grid: { color: '#1e293b' } } }, plugins: { legend: { display: false } } }} /></div></div>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Methodology Insight</h4>
                  <div className="p-6 bg-slate-950 rounded-3xl border border-slate-800/50 space-y-4">
                    <p className="text-sm text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: ALGORITHM_METADATA[algorithm].desc }}></p>
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto"><BlockMath math={ALGORITHM_METADATA[algorithm].math} /></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-slate-900/50 p-8 rounded-[2rem] border border-slate-800 space-y-4 border-l-4 border-l-rose-500">
                  <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Prior Research Challenge</div>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium">{ALGORITHM_METADATA[algorithm].problem}</p>
                </div>
                <div className="bg-slate-900/50 p-8 rounded-[2rem] border border-slate-800 space-y-4 border-l-4 border-l-blue-500">
                  <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Proposed Solution</div>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium">{ALGORITHM_METADATA[algorithm].solution}</p>
                </div>
                <div className="bg-slate-900/50 p-8 rounded-[2rem] border border-slate-800 space-y-4 border-l-4 border-l-amber-500">
                  <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Next Objective</div>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium">{ALGORITHM_METADATA[algorithm].challenge}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black tracking-tight flex items-center gap-3"><Layers size={24} className="text-blue-500" /> ENSEMBLE COMPARISON</h3><div className="px-4 py-2 bg-slate-950 rounded-2xl border border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">Parallel Benchmark (Thesis Params)</div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {ALGORITHMS.map(alg => {
                    const result = compareResults[alg];
                    const isWinner = alg === bestAlg;
                    return (
                      <div key={alg} className={`relative bg-slate-950 p-6 rounded-[2rem] border transition-all duration-500 ${isWinner ? 'border-amber-500/50 shadow-2xl shadow-amber-500/10 scale-[1.02]' : 'border-slate-800 hover:border-slate-700'}`}>
                        {isWinner && <div className="absolute -top-4 -right-4 bg-amber-500 text-black p-3 rounded-2xl shadow-2xl z-20 animate-bounce"><Crown size={24} fill="currentColor" /></div>}
                        <div className="flex justify-between items-start mb-6"><div><h4 className="text-2xl font-black tracking-tighter text-white">{alg}</h4><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{result?.time ? `${result.time.toFixed(1)}ms` : 'Ready'}</p></div><div className="flex gap-4"><div className="text-right"><div className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">PSNR</div><div className="text-base font-mono font-bold text-blue-400">{result?.psnr.toFixed(2) || '0.00'}</div></div><div className="text-right border-l border-slate-800 pl-4"><div className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">SSIM</div><div className="text-base font-mono font-bold text-emerald-400">{result?.ssim.toFixed(4) || '.0000'}</div></div></div></div>
                        <div className="grid grid-cols-2 gap-4"><div className="space-y-2 text-center"><div className="rounded-2xl border border-slate-800 overflow-hidden aspect-square bg-slate-900">{result ? <img src={result.url} alt={alg} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Activity size={24} className="text-slate-800 animate-pulse" /></div>}</div><span className="text-[8px] font-black text-slate-600 uppercase">Restored</span></div><div className="space-y-2 text-center"><div className="rounded-2xl border border-slate-800 overflow-hidden aspect-square bg-slate-900">{result ? <img src={result.heatmapUrl} alt={`${alg} heatmap`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ShieldCheck size={24} className="text-slate-800 animate-pulse" /></div>}</div><span className="text-[8px] font-black text-slate-600 uppercase">Quality Map</span></div></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
