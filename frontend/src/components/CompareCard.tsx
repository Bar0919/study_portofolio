import React, { useState } from 'react';
import { Crown, Activity, ShieldCheck, Settings2 } from 'lucide-react';
import { ImageInspector } from './ImageInspector';
import { ConfigPanel } from './ConfigPanel';

interface CompareResult {
  url: string;
  heatmapUrl: string;
  psnr: number;
  ssim: number;
  time: number;
}

interface Props {
  alg: string;
  result: CompareResult | undefined;
  isWinner: boolean;
  params: Record<string, any>;
  isAuto: boolean;
  onParamChange: (key: string, val: any) => void;
  onToggleAuto: () => void;
}

export const CompareCard: React.FC<Props> = ({ alg, result, isWinner, params, isAuto, onParamChange, onToggleAuto }) => {
  const [showConfig, setShowConfig] = useState(false);

  return (
    <div className={`relative bg-slate-950 p-6 rounded-[2rem] border transition-all duration-500 flex flex-col h-full ${isWinner ? 'border-amber-500/50 shadow-2xl shadow-amber-500/10 scale-[1.02] z-10' : 'border-slate-800 hover:border-slate-700'}`}>
      {isWinner && <div className="absolute -top-4 -right-4 bg-amber-500 text-black p-3 rounded-2xl shadow-2xl z-20 animate-bounce"><Crown size={24} fill="currentColor" /></div>}
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-2xl font-black tracking-tighter text-white">{alg}</h4>
            {alg === 'GMRF' && <span className="px-1.5 py-0.5 bg-slate-800 text-slate-500 text-[10px] font-black rounded border border-slate-700">PREV</span>}
            {alg === 'HGMRF' && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-900 text-[10px] font-black rounded shadow-sm">BACHELOR</span>}
            {(alg === 'rTV-MRF' || alg === 'LC-MRF') && <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded shadow-sm">MASTER</span>}
          </div>
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">{result?.time ? `${result.time.toFixed(1)}ms` : 'Ready'}</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">PSNR</div>
            <div className="text-lg font-mono font-bold text-blue-400">{result?.psnr.toFixed(2) || '0.00'}</div>
          </div>
          <div className="text-right border-l border-slate-800 pl-4">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">SSIM</div>
            <div className="text-lg font-mono font-bold text-emerald-400">{result?.ssim.toFixed(4) || '.0000'}</div>
          </div>
        </div>
      </div>

      <div className="mb-4 text-right">
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1 ml-auto transition-all ${showConfig ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
        >
          <Settings2 size={12} /> {showConfig ? 'Hide Config' : 'Tuning'}
        </button>
      </div>

      {showConfig ? (
        <div className="flex-1 bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
          <ConfigPanel 
            algorithm={alg}
            params={params}
            isAuto={isAuto}
            onParamChange={onParamChange}
            onToggleAuto={onToggleAuto}
            compact={true}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 flex-1">
          <div className="space-y-2 text-center h-full flex flex-col">
            <div className="rounded-2xl border border-slate-800 overflow-hidden aspect-square bg-slate-900 flex-1">
              {result ? (
                <ImageInspector isEnabled={true} zoomImage={result.url}>
                  <img src={result.url} alt={alg} className="w-full h-full object-cover" />
                </ImageInspector>
              ) : <div className="w-full h-full flex items-center justify-center"><Activity size={24} className="text-slate-800 animate-pulse" /></div>}
            </div>
            <span className="text-[8px] font-black text-slate-600 uppercase">Restored</span>
          </div>
          <div className="space-y-2 text-center h-full flex flex-col">
            <div className="rounded-2xl border border-slate-800 overflow-hidden aspect-square bg-slate-900 flex-1">
              {result ? (
                <ImageInspector isEnabled={true} zoomImage={result.heatmapUrl}>
                  <img src={result.heatmapUrl} alt={`${alg} heatmap`} className="w-full h-full object-cover" />
                </ImageInspector>
              ) : <div className="w-full h-full flex items-center justify-center"><ShieldCheck size={24} className="text-slate-800 animate-pulse" /></div>}
            </div>
            <span className="text-[8px] font-black text-slate-600 uppercase">Quality Map</span>
          </div>
        </div>
      )}
    </div>
  );
};
