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
    <div className="flex-1 overflow-y-auto custom-scrollbar p-12 flex flex-col items-center">
      <div className="w-full max-w-4xl animate-fade-in">
        <div className="flex items-end gap-6 mb-12">
          <div className="w-20 h-20 bg-[var(--accent-olive)]/10 flex items-center justify-center rounded-lg border border-[var(--accent-olive)]/20">
            <Trophy size={40} className="text-[var(--accent-olive)]" />
          </div>
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-white mb-2">INTELLIGENCE ASSETS</h2>
            <p className="text-[var(--text-dim)] text-sm tracking-widest uppercase font-medium">Top Financial Contributors</p>
          </div>
        </div>

        <div className="grid gap-3">
          {data.map((donator, index) => (
            <div
              key={index}
              className="glass-panel p-5 flex items-center justify-between group hover:border-[var(--accent-olive)]/40 transition-all duration-300"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="flex items-center gap-6">
                <div className="w-10 h-10 flex items-center justify-center font-bold text-lg mono" style={{ color: index < 3 ? 'var(--accent-olive)' : 'var(--text-dim)' }}>
                  {(index + 1).toString().padStart(2, '0')}
                </div>
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <User size={20} className="text-white/40" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-[var(--accent-olive)] transition-colors">{donator.name}</h3>
                  <p className="text-[9px] tracking-widest text-[var(--text-dim)] uppercase font-bold mt-1">Verified Entity • </p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end text-[var(--accent-olive)] font-bold text-2xl mono">
                    <DollarSign size={20} />
                    <span suppressHydrationWarning>{donator.total.toLocaleString()}</span>
                  </div>
                  <div className="text-[9px] tracking-widest text-[var(--text-dim)] uppercase font-bold mt-1">Total Contribution (USD)</div>
                </div>
                <ArrowUpRight size={24} className="text-white/10 group-hover:text-[var(--accent-olive)] transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
