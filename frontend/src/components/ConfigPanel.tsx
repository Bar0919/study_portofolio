import React from 'react';
import { PARAM_HELP } from '../constants/data';

interface Props {
  algorithm: string;
  params: Record<string, any>;
  isAuto: boolean;
  onParamChange: (key: string, val: any) => void;
  onToggleAuto: () => void;
  compact?: boolean;
}

export const ConfigPanel: React.FC<Props> = ({ algorithm, params, isAuto, onParamChange, onToggleAuto, compact = false }) => {
  return (
    <div className={`space-y-4 ${compact ? 'pt-2' : 'pt-4 border-t border-slate-800/50'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
          {algorithm} Config
        </span>
        <button 
          onClick={onToggleAuto} 
          className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${isAuto ? 'bg-blue-600/20 text-blue-400' : 'bg-amber-600/20 text-amber-400'}`}
        >
          {isAuto ? 'Thesis Defaults' : 'Manual Tuning'}
        </button>
      </div>
      
      {!isAuto && (
        <div className={`space-y-4 overflow-y-auto pr-2 custom-scrollbar ${compact ? 'max-h-[200px]' : 'max-h-[350px]'}`}>
          {/* is_learning (Estimation Toggle) should always be first */}
          {Object.keys(params).sort((a, b) => {
            if (a === 'is_learning') return -1;
            if (b === 'is_learning') return 1;
            return 0;
          }).map(key => {
            const isBool = typeof params[key] === 'boolean';
            const label = key === 'is_learning' ? 'Perform Estimation' : key;
            return (
              <div key={key} className={`space-y-2 group ${compact ? 'p-3 bg-slate-900/50 rounded-xl' : ''}`}>
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-500 uppercase">{label}</label>
                  {isBool ? (
                    <button 
                      onClick={() => onParamChange(key, !params[key])} 
                      className={`w-10 h-5 rounded-full transition-all relative ${params[key] ? 'bg-emerald-600' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${params[key] ? 'left-6' : 'left-1'}`}></div>
                    </button>
                  ) : (
                    <span className="text-xs font-mono text-blue-400">{params[key]}</span>
                  )}
                </div>
                {!isBool && (
                  <input 
                    type="number" 
                    step={key.includes('eta') || key.includes('lambda') ? "0.00000000000001" : "0.01"} 
                    value={params[key]} 
                    onChange={(e) => onParamChange(key, parseFloat(e.target.value))} 
                    className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 text-sm font-mono focus:outline-none focus:border-blue-500 transition-all ${compact ? 'py-1' : 'py-2'}`} 
                  />
                )}
                {!compact && <p className="text-xs text-slate-600 italic group-hover:text-slate-400">{PARAM_HELP[key]}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
