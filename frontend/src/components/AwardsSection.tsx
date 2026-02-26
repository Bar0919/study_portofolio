import React from 'react';
import { Award, GraduationCap, Presentation, Star, ExternalLink } from 'lucide-react';

export const AwardsSection: React.FC = () => {
  return (
    <div className="pt-12 pb-8 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-800" />
        <h2 className="text-2xl font-black tracking-widest text-white flex items-center gap-3">
          <Award className="text-amber-500" size={28} /> AWARDS & HONORS
        </h2>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-800" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Master's Degree */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-blue-400">
            <GraduationCap size={24} />
            <h3 className="text-lg font-black uppercase tracking-tight">Master's Degree</h3>
          </div>
          
          <div className="space-y-4">
            <AwardCard 
              title="情報処理学会（IPSJ） 第87回全国大会 学生奨励賞"
              date="2024年3月"
              link="https://www.ipsj.or.jp/award/taikaigakusei.html"
              description="統計的機械学習を用いた画像ノイズ除去モデルの研究発表において、その新規性と有用性が対外的に高く評価されました。"
            />
            <AwardCard 
              title="理工学研究科 優秀学生表彰"
              date="2024年3月"
              link="https://www.adv-pip.yz.yamagata-u.ac.jp/achievement.html"
              description="修士課程における累計の学業成績および研究成果が研究科内で極めて優秀であると認められ、表彰を受けました。"
            />
            <AwardCard 
              title="情報・エレクトロニクス専攻 優秀発表賞"
              date="2024年3月"
              link="https://www.adv-pip.yz.yamagata-u.ac.jp/achievement.html"
              description="修士論文発表会において、複雑な数理モデルの論理的かつ明快なプレゼンテーション能力が評価されました。"
            />
          </div>
        </div>

        {/* Bachelor's Degree */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-slate-400">
            <Star size={24} />
            <h3 className="text-lg font-black uppercase tracking-tight">Bachelor's Degree</h3>
          </div>

          <div className="space-y-4">
            <AwardCard 
              title="優秀学生賞"
              date="2023年3月"
              link="https://infoele.yz.yamagata-u.ac.jp/topics/info/topics_20230330523/"
              description="学部課程における学業成績トップクラスの学生として選出されました。"
            />
            <AwardCard 
              title="優秀発表賞"
              date="2023年3月"
              link="https://infoele.yz.yamagata-u.ac.jp/topics/info/topics_20230330523/"
              description="卒業論文発表において、優れた研究内容と伝達能力が評価されました。"
              icon={<Presentation size={18} />}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const AwardCard: React.FC<{ 
  title: string, 
  date: string, 
  description: string, 
  link: string,
  icon?: React.ReactNode 
}> = ({ title, date, description, link, icon }) => (
  <div className="group relative p-6 bg-slate-900/40 border border-slate-800 hover:border-blue-500/50 rounded-3xl transition-all hover:shadow-2xl hover:shadow-blue-500/5 overflow-hidden">
    <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="flex justify-between items-start mb-2">
      <h4 className="text-sm font-black text-slate-100 leading-snug flex-1 pr-4">{title}</h4>
      <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">{date}</span>
    </div>
    <p className="text-xs text-slate-400 leading-relaxed mb-4">{description}</p>
    <a 
      href={link} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="inline-flex items-center gap-1.5 text-[10px] font-black text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest"
    >
      Official Records <ExternalLink size={10} />
    </a>
  </div>
);
