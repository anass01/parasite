"use client";

import React, { useEffect, useState } from 'react';
import { Trophy, ArrowUpRight, DollarSign, User } from 'lucide-react';

interface Donator {
  name: string;
  total: number;
}

export default function LeaderboardView() {
  const [data, setData] = useState<Donator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load leaderboard:", err);
        setLoading(false);
      });
  }, []);

  if (!isMounted || loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-[var(--accent-olive)]/20 border-t-[var(--accent-olive)] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-16 flex flex-col items-center bg-transparent">
      <div className="w-full max-w-5xl animate-fade-in">
        <div className="flex items-end gap-8 mb-16">
          <div className="w-24 h-24 bg-[var(--accent-olive)]/10 flex items-center justify-center rounded-xl border border-[var(--accent-olive)]/20 shadow-[0_0_30px_rgba(181,232,83,0.1)]">
            <Trophy size={48} className="text-[var(--accent-olive)]" />
          </div>
          <div className="flex-1 pb-2 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-5xl font-bold tracking-tight text-white mb-2">INTELLIGENCE ASSETS</h2>
                <p className="text-[var(--text-dim)] text-[10px] tracking-[0.3em] uppercase font-bold">Priority Target Financial Contributions</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Last Update</div>
                <div className="text-xs font-bold text-[var(--accent-olive)] mono">02 MAY 2026 21:42</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {data.map((donator, index) => (
            <div
              key={index}
              className="glass-panel p-6 flex items-center justify-between group hover:border-[var(--accent-olive)]/40 transition-all duration-500 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.015)', borderRadius: '12px' }}
            >
              <div className="flex items-center gap-8">
                <div className="w-12 h-12 flex items-center justify-center font-bold text-xl mono" style={{ color: index < 3 ? 'var(--accent-olive)' : 'var(--text-dim)' }}>
                  {(index + 1).toString().padStart(2, '0')}
                </div>
                <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center border border-white/10 group-hover:border-[var(--accent-olive)]/30 transition-colors">
                  <User size={24} className="text-white/20 group-hover:text-[var(--accent-olive)]/40 transition-colors" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-[var(--accent-olive)] transition-colors duration-300">{donator.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] tracking-widest text-[var(--text-dim)] uppercase font-bold">Verified Asset • </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-olive)]/50"></span>
                    <span className="text-[10px] tracking-widest text-[var(--text-dim)] uppercase font-bold">Class {index < 3 ? 'A' : 'B'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-10">
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end text-[var(--accent-olive)] font-bold text-3xl mono tracking-tighter">
                    <DollarSign size={24} className="opacity-50" />
                    <span>CLASSIFIED</span>
                  </div>
                  <div className="text-[10px] tracking-[0.2em] text-[var(--text-dim)] uppercase font-bold mt-1.5">Contribution Index (USD)</div>
                </div>
                <div className="w-10 h-10 flex items-center justify-center rounded-full border border-white/5 group-hover:border-[var(--accent-olive)]/20 transition-all">
                  <ArrowUpRight size={20} className="text-white/10 group-hover:text-[var(--accent-olive)] transition-all transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
