import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ALGORITHM_METADATA } from '../constants/data';

interface Props {
  algorithm: string;
}

export const InsightCard: React.FC<Props> = ({ algorithm }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const meta = ALGORITHM_METADATA[algorithm];

  useEffect(() => {
    if (containerRef.current && meta?.math) {
      try {
        katex.render(meta.math, containerRef.current, {
          throwOnError: false,
          displayMode: true
        });
      } catch (err) {
        console.error('KaTeX rendering error:', err);
      }
    }
  }, [algorithm, meta?.math]);

  if (!meta) return null;

  return (
    <div className="pt-8 space-y-8">
      <div className="flex items-center gap-4">
        <h3 className="text-2xl font-black tracking-tighter text-white">{meta.name}</h3>
        {algorithm === 'HGMRF' && (
          <span className="px-3 py-1 bg-slate-100 text-slate-900 rounded-full text-xs font-black tracking-widest shadow-lg shadow-white/10 ring-4 ring-slate-800/50">BACHELOR RESEARCH</span>
        )}
        {(algorithm === 'rTV-MRF' || algorithm === 'LC-MRF') && (
          <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-black tracking-widest shadow-lg shadow-blue-500/30 ring-4 ring-blue-900/50">MASTER RESEARCH</span>
        )}
        <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-black uppercase tracking-widest">{meta.tagline}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        <div className="space-y-6">
          <div className="p-6 bg-slate-950 rounded-3xl border border-slate-800/50">
            <p className="text-base text-slate-300 leading-relaxed mb-6" dangerouslySetInnerHTML={{ __html: meta.desc }}></p>
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto">
              {/* 直接レンダリング対象の要素 */}
              <div ref={containerRef} className="text-white min-h-[3rem]" />
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="p-5 bg-rose-500/5 border border-rose-500/20 rounded-2xl space-y-2">
            <div className="text-xs font-black text-rose-500 uppercase tracking-widest">Prior Research Challenge</div>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">{meta.problem}</p>
          </div>
          <div className="p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-2">
            <div className="text-xs font-black text-blue-500 uppercase tracking-widest">Proposed Solution</div>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">{meta.solution}</p>
          </div>
          <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-2">
            <div className="text-xs font-black text-amber-500 uppercase tracking-widest">Next Objective</div>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">{meta.challenge}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
