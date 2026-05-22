"use client";

import React, { useState, useEffect, useMemo } from 'react';
import IntelligenceGraph from '@/components/IntelligenceGraph';
import Sidebar from '@/components/Sidebar';
import LeaderboardView from '@/components/LeaderboardView';
import ProfilerView from '@/components/ProfilerView';
import { Search as SearchIcon, Trophy, Database, LayoutGrid, LogOut, Brain } from 'lucide-react';

interface GraphNode {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  degree: number;
  val: number;
  neighborIds: string[];
  links: { id: string; name: string; relation: string }[];
  lastSeen?: string | null;
  x?: number;
  y?: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: { source: string | GraphNode; target: string | GraphNode; relation: string }[];
}

export default function Home() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'graph' | 'leaderboard' | 'profiler'>('graph');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetch('/api/graph')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const filteredNodes = useMemo((): GraphNode[] => {
    if (!data?.nodes || !searchQuery) return [];
    return data.nodes
      .filter((n) => n.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 8);
  }, [data, searchQuery]);

  // Prevent hydration mismatch by only rendering client-only parts after mounting
  if (!isMounted) {
    return <div className="h-screen w-full bg-[var(--bg-dark)]" />;
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[var(--bg-dark)]">
      {/* Top Navigation Bar */}
      <header className="shrink-0 h-[var(--nav-height)] glass-header flex items-center justify-between px-8 z-40 relative">
        {/* Left Section: Brand & Search */}
        <div className="flex-1 flex items-center gap-8">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveView('graph')}>
            <div className="intel-border shrink-0 w-7 h-7 flex items-center justify-center transition-all group-hover:bg-[var(--accent-olive)] group-hover:border-transparent">
              <Database size={14} className="text-[var(--accent-olive)] group-hover:text-black transition-colors" />
            </div>
            <div className="text-sm font-bold tracking-[0.25em] flex items-center gap-2 intel-text" style={{ color: 'var(--text-main)' }}>
              PARASITE <span className="font-medium text-[9px] opacity-20 mono">V0.0.38</span>
            </div>
          </div>

          <div className="relative group">
            <div className="intel-search-container h-9 flex items-center gap-3 px-4 transition-all">
              <span className="intel-search-label">INTEL_QUERY</span>
              <SearchIcon size={12} className="text-[var(--text-dim)] group-focus-within:text-[var(--accent-olive)] transition-colors" />
              <input
                type="text"
                placeholder="SEARCH_ENTITIES..."
                className="bg-transparent border-none outline-none text-[10px] w-[220px] text-white placeholder:text-white/20 mono uppercase tracking-widest"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {filteredNodes.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 pt-3">
                <div className="glass-panel p-2 animate-fade-in intel-border">
                  <div className="px-3 py-1.5 text-[8px] font-bold tracking-[0.3em] text-[var(--accent-olive)] uppercase border-b border-white/5 mb-1">SEARCH_RESULTS</div>
                  {filteredNodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-2 text-[10px] text-white cursor-pointer flex items-center justify-between hover-olive mb-0.5 mono"
                      onClick={() => {
                        setSelectedNode(node);
                        setSearchQuery('');
                        setActiveView('graph');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs opacity-50">{node.icon}</span>
                        <span className="font-bold tracking-widest">{node.name}</span>
                      </div>
                      <span className="opacity-30 uppercase text-[8px]">{node.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Section: Navigation (Military Style) */}
        <div className="flex justify-center">
          <nav className="nav-pill">
            <NavItem
              icon={<LayoutGrid size={13} />}
              label="GRAPH"
              active={activeView === 'graph'}
              onClick={() => setActiveView('graph')}
            />
            <NavItem
              icon={<Trophy size={13} />}
              label="LEADERBOARD"
              active={activeView === 'leaderboard'}
              onClick={() => setActiveView('leaderboard')}
            />
            <NavItem
              icon={<Brain size={13} />}
              label="PROFILER"
              active={activeView === 'profiler'}
              onClick={() => setActiveView('profiler')}
            />
          </nav>
        </div>

        {/* Right Section: Status & Actions */}
        <div className="flex-1 flex items-center justify-end gap-6 px-6" style={{ justifyContent: 'flex-end' }}>
          <div className="intel-bracket flex text-[10px] font-bold tracking-[0.2em] items-center gap-3 py-1.5 mono">
            <span className="w-1.5 h-1.5 bg-[var(--accent-olive)] animate-pulse-glow shadow-[0_0_8px_var(--accent-olive)]"></span>
            <span style={{ color: 'var(--text-dim)' }}>STATUS: <span className="text-[var(--accent-olive)]">WIP</span></span>
          </div>
          <button
            className="intel-border w-9 h-9 flex items-center justify-center hover:bg-[var(--accent-red)]/10 hover:border-[var(--accent-red)] transition-all group"
            title="TERMINATE_SESSION"
            style={{ background: 'transparent', cursor: 'pointer' }}
          >
            <LogOut size={16} className="text-[var(--text-dim)] group-hover:text-[var(--accent-red)] transition-colors" />
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
              data && (
                <IntelligenceGraph
                  data={data}
                  onNodeSelect={setSelectedNode}
                  selectedNode={selectedNode}
                />
              )
            ) : activeView === 'leaderboard' ? (
              <LeaderboardView />
            ) : (
              <ProfilerView />
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
      className={`nav-item ${active ? 'nav-item-active' : 'text-white/40'}`}
      onClick={onClick}
    >
      {active && (
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-black"></div>
          <div className="absolute top-1 left-1 w-1 h-1 border-t border-l border-black"></div>
        </div>
      )}
      <span className="shrink-0 relative z-10">{icon}</span>
      <span className="intel-text text-[10px] font-black relative z-10">{label}</span>
      {active && (
        <div className="ml-2 w-1.5 h-1.5 bg-black intel-active-marker"></div>
      )}
    </div>
  );
}
