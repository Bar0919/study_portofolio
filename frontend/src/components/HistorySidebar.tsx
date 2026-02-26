import React from 'react';
import { Timer, Activity } from 'lucide-react';

interface RunHistory {
  id: number;
  timestamp: string;
  algorithm: string;
  sigma: number;
  psnr: number;
  ssim: number;
  time: number;
  params: any;
}

interface Props {
  history: RunHistory[];
  onClear: () => void;
}

export const HistorySidebar: React.FC<Props> = ({ history, onClear }) => {
  return (
    <aside className="space-y-6">
      <div className="bg-slate-900/80 backdrop-blur-2xl p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
            <Timer size={14} className="text-blue-500" /> HISTORY
          </h4>
          <button onClick={onClear} className="text-xs font-black text-rose-500/40 hover:text-rose-500 transition-colors uppercase">Clear</button>
        </div>
        
        <div className="space-y-3 max-h-[calc(100vh-150px)] overflow-y-auto pr-2 custom-scrollbar">
          {history.length === 0 ? (
            <div className="py-12 text-center space-y-3 opacity-20">
              <Activity className="mx-auto text-slate-500" size={32} />
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">No records yet</p>
            </div>
          ) : (
            history.map((run) => (
              <div key={run.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-blue-500/50 transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <span className="px-2 py-0.5 bg-blue-600 rounded text-[9px] font-black text-white">{run.algorithm}</span>
                  <span className="text-[9px] font-mono text-slate-600">{run.timestamp}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-[10px] font-black text-slate-600 uppercase">PSNR</div>
                    <div className="text-base font-mono font-bold text-blue-400">{run.psnr.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-600 uppercase">SSIM</div>
                    <div className="text-base font-mono font-bold text-emerald-400">{run.ssim.toFixed(4)}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800/50">
                  <div className="text-[10px] font-black text-slate-600 uppercase">σ: <span className="text-slate-400">{run.sigma}</span></div>
                  <div className="text-[10px] font-black text-slate-600 uppercase">{run.time.toFixed(0)}ms</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};
