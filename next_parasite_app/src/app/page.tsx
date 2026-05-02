"use client";

import React, { useState, useEffect, useMemo } from 'react';
import IntelligenceGraph from '@/components/IntelligenceGraph';
import Sidebar from '@/components/Sidebar';
import LeaderboardView from '@/components/LeaderboardView';
import { Search as SearchIcon, Command, Trophy, Database, LayoutGrid, LogOut } from 'lucide-react';

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<'graph' | 'leaderboard'>('graph');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetch('/api/graph')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load graph data:", err);
        setLoading(false);
      });
  }, []);

  const filteredNodes = useMemo(() => {
    if (!data?.nodes || !searchQuery) return [];
    return data.nodes
      .filter((n: any) => n.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 8);
  }, [data, searchQuery]);

  // Prevent hydration mismatch by only rendering client-only parts after mounting
  if (!isMounted) {
    return <div className="h-screen w-full bg-[var(--bg-dark)]" />;
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[var(--bg-dark)]">
      {/* Top Navigation Bar */}
      <header className="shrink-0 h-[56px] glass-panel-light flex items-center px-6 justify-between z-40 relative">
        {/* Left Section: Brand & Search */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveView('graph')}>
            <div className="shrink-0 w-6 h-6 bg-[var(--accent-olive)] flex items-center justify-center" style={{ borderRadius: '2px' }}>
              <Database size={14} className="text-black" />
            </div>
            <div className="text-sm font-bold tracking-widest flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
              PARASITE <span className="font-normal text-xs opacity-30">v0.0.38</span>
            </div>
          </div>

          <div className="relative group">
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5" style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
              <SearchIcon size={14} style={{ color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Search intelligence..."
                className="bg-transparent border-none outline-none text-xs w-[280px] text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="flex items-center gap-1 px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-white/30">
                <Command size={8} /> K
              </div>
            </div>

            {filteredNodes.length > 0 && (
              <div className="absolute top-full left-0 w-full glass-panel p-1 z-50 animate-fade-in" style={{ marginTop: '8px', borderRadius: '4px' }}>
                {filteredNodes.map((node: any) => (
                  <div
                    key={node.id}
                    className="p-2 text-xs text-white cursor-pointer flex items-center justify-between hover-olive"
                    onClick={() => {
                      setSelectedNode(node);
                      setSearchQuery("");
                      setActiveView('graph');
                    }}
                    style={{ borderRadius: '4px' }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{node.icon}</span>
                      <span>{node.name}</span>
                    </div>
                    <span className="opacity-30 uppercase" style={{ fontSize: '9px' }}>{node.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Section (Nav) */}
        <nav className="flex h-full items-center text-xs font-bold tracking-widest" style={{ color: 'var(--text-dim)' }}>
          <NavItem
            icon={<LayoutGrid size={12} />}
            label="GRAPH"
            active={activeView === 'graph'}
            onClick={() => setActiveView('graph')}
          />
          <NavItem
            icon={<Trophy size={12} />}
            label="LEADERBOARD"
            active={activeView === 'leaderboard'}
            onClick={() => setActiveView('leaderboard')}
          />
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          <div className="flex text-xs items-center gap-2 px-3 py-1.5" style={{ color: 'var(--text-dim)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-olive)] animate-pulse" style={{ borderRadius: '50%' }}></span>
            ONLINE
          </div>
          <button className="p-2 hover:text-[var(--accent-red)] transition-colors" style={{ color: 'var(--text-dim)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div className="scanline"></div>
        <div className="graph-overlay"></div>

        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-50">
            <div className="w-12 h-12 animate-pulse" style={{ border: '2px solid var(--accent-olive)', borderRadius: '50%', borderTopColor: 'transparent' }}></div>
            <div className="mt-4 text-xs font-bold tracking-widest uppercase animate-pulse" style={{ color: 'var(--accent-olive)' }}>Initializing Neural Link...</div>
          </div>
        ) : (
          <>
            {activeView === 'graph' ? (
              <IntelligenceGraph
                data={data}
                onNodeSelect={setSelectedNode}
                selectedNode={selectedNode}
              />
            ) : (
              <LeaderboardView />
            )}
          </>
        )}

        {/* Sidebar wrapper */}
        <div
          className={`fixed right-0 z-30 sidebar-wrapper ${selectedNode && activeView === 'graph' ? 'sidebar-open' : 'sidebar-closed'}`}
          style={{ top: '56px', bottom: '0', height: 'calc(100vh - 56px)', width: '420px', overflow: 'hidden' }}
        >
          <Sidebar
            selectedNode={selectedNode}
            allNodes={data?.nodes || []}
            onNodeSelect={setSelectedNode}
          />
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <div
      className={`flex items-center gap-2 px-6 h-full transition-all cursor-pointer ${active ? 'nav-active' : ''}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
