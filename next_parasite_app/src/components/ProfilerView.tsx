"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { User, MessageSquare, Shield, Activity, Brain, Search, Terminal, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Virtuoso } from 'react-virtuoso';

interface UserStats {
    name: string;
    message_count: number;
    last_seen: string;
}

export default function ProfilerView() {
    const [users, setUsers] = useState<UserStats[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [insights, setInsights] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/profiler/users')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setUsers(data);
                    if (data.length > 0) {
                        setSelectedUser(data[0]);
                    }
                } else if (data.error) {
                    setError(data.error);
                    setUsers([]);
                } else {
                    setError('Unexpected response from server.');
                    setUsers([]);
                }
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setUsers([]);
                setLoading(false);
            });
    }, []);

    const filteredUsers = useMemo(() => {
        if (!Array.isArray(users)) return [];
        return users.filter(u => u.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [users, searchQuery]);

    const generateInsights = async () => {
        if (!selectedUser) return;
        setGenerating(true);
        setInsights(null);

        try {
            const res = await fetch('/api/profiler/insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: selectedUser.name })
            });
            const data = await res.json();
            if (data.insights) {
                setInsights(data.insights);
            } else {
                setInsights("Error: " + (data.error || "Unknown error"));
            }
        } catch (err) {
            setInsights("Failed to generate insights.");
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-2 border-[var(--accent-olive)]/20 border-t-[var(--accent-olive)] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex h-full overflow-hidden bg-transparent">
            {/* User List Sidebar */}
            <div className="shrink-0 border-r border-white/10 flex flex-col glass-header z-20" style={{ width: '30%' }}>
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                        <Activity size={14} className="text-[var(--accent-olive)]" />
                        <span className="text-[10px] font-bold tracking-[0.4em] uppercase text-white/40">Signal_Directory</span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                        <input
                            type="text"
                            placeholder="FILTER_SUBJECTS..."
                            className="w-full h-8 bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-[10px] mono uppercase tracking-widest text-white focus:outline-none focus:border-[var(--accent-olive)]/40 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-hidden">
                    {error && (
                        <div className="p-4 m-6 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400 mono">
                            ERROR: {error}
                        </div>
                    )}
                    <Virtuoso
                        data={filteredUsers}
                        className="custom-scrollbar px-2"
                        itemContent={(index, user) => (
                            <div className="py-2">
                                <div
                                    className={`relative cursor-pointer transition-all duration-300 group overflow-hidden ${selectedUser?.name === user.name ? 'bg-[var(--accent-olive)]/15' : 'bg-white/[0.02] hover:bg-white/[0.08]'}`}
                                    style={{
                                        border: selectedUser?.name === user.name ? '1px solid var(--accent-olive)' : '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: '2px'
                                    }}
                                    onClick={() => {
                                        setSelectedUser(user);
                                        setInsights(null);
                                    }}
                                >
                                    {/* Intelligence Brackets for Selected/Hover */}
                                    <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 transition-all duration-300 ${selectedUser?.name === user.name ? 'border-[var(--accent-olive)]' : 'border-white/0 group-hover:border-white/20'}`}></div>
                                    <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 transition-all duration-300 ${selectedUser?.name === user.name ? 'border-[var(--accent-olive)]' : 'border-white/0 group-hover:border-white/20'}`}></div>
                                    <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 transition-all duration-300 ${selectedUser?.name === user.name ? 'border-[var(--accent-olive)]' : 'border-white/0 group-hover:border-white/20'}`}></div>
                                    <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 transition-all duration-300 ${selectedUser?.name === user.name ? 'border-[var(--accent-olive)]' : 'border-white/0 group-hover:border-white/20'}`}></div>

                                    <div className="p-4 flex items-center justify-between w-full relative z-10">
                                        <div className="flex items-center gap-5">
                                            <div className={`w-12 h-12 flex items-center justify-center transition-all duration-500 ${selectedUser?.name === user.name ? 'bg-[var(--accent-olive)] text-black' : 'bg-white/[0.03] border border-white/10 text-white/20 group-hover:border-white/30 group-hover:text-white/60'}`} style={{ borderRadius: '2px' }}>
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className={`w-1.5 h-1.5 transition-colors ${selectedUser?.name === user.name ? 'bg-[var(--accent-olive)] animate-pulse' : 'bg-white/10'}`}></div>
                                                    <div className={`text-[13px] font-black tracking-[0.1em] uppercase truncate transition-colors duration-300 ${selectedUser?.name === user.name ? 'text-[var(--accent-olive)]' : 'text-white'}`} style={{ maxWidth: '300px' }}>
                                                        {user.name}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[9px] text-[var(--text-dim)] font-black tracking-widest mono uppercase">
                                                        Signal_Strength: <span className={selectedUser?.name === user.name ? 'text-white' : ''}>{Math.min(100, Math.floor(user.message_count / 10))}%</span>
                                                    </span>
                                                    <span className="w-1 h-1 rounded-full bg-white/5"></span>
                                                    <span className="text-[9px] text-[var(--text-dim)] font-black tracking-widest mono uppercase">
                                                        Data_Sets: <span className={selectedUser?.name === user.name ? 'text-white' : ''}>{user.message_count.toLocaleString()}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`flex flex-col items-end gap-1 transition-all duration-500 ${selectedUser?.name === user.name ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                                            <div className="text-[8px] font-bold text-[var(--accent-olive)] tracking-tighter mono">TARGET_LOCKED</div>
                                            <ChevronRight size={16} className="text-[var(--accent-olive)]" />
                                        </div>
                                    </div>

                                    {/* Scanline Background for Selected */}
                                    {selectedUser?.name === user.name && (
                                        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(181,232,83,0)_50%,rgba(181,232,83,1)_50%)] bg-[length:100%_4px]"></div>
                                    )}
                                </div>
                            </div>
                        )}
                    />
                </div>
            </div>

            {/* User Profile Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-12 relative">
                {selectedUser ? (
                    <div className="mx-auto animate-fade-in">
                        <div className="flex items-start justify-between mb-12">
                            <div className="flex items-center gap-8">
                                <div className="w-24 h-24 bg-[var(--accent-olive)]/10 flex items-center justify-center rounded-2xl border border-[var(--accent-olive)]/20 shadow-[0_0_30px_rgba(181,232,83,0.05)]">
                                    <Shield size={48} className="text-[var(--accent-olive)]" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-[var(--accent-olive)] tracking-[0.4em] uppercase mb-2">Subject Profiler</div>
                                    <h1 className="text-5xl font-black text-white tracking-tight uppercase mb-4">{selectedUser.name}</h1>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare size={12} className="text-[var(--text-dim)]" />
                                            <span className="text-xs font-bold text-white/60 mono">{selectedUser.message_count} TRANSMISSIONS</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Activity size={12} className="text-[var(--text-dim)]" />
                                            <span className="text-xs font-bold text-white/60 mono uppercase">Active Status: Verified</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={generateInsights}
                                disabled={generating}
                                className={`intel-button px-6 py-4 h-16 flex items-center gap-1 group transition-all ${generating ? 'opacity-50 cursor-wait' : 'hover:bg-[var(--accent-olive)] hover:text-black'}`}
                            >
                                <Brain size={16} className={generating ? 'animate-pulse' : 'group-hover:rotate-12 transition-transform'} />
                                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">
                                    {generating ? 'ANALYZING_SUBJECT...' : 'GENERATE_INSIGHTS'}
                                </span>
                            </button>
                        </div>

                        {/* Insights Section */}
                        <div className="space-y-8">
                            <div className="grid grid-cols-3 gap-6">
                                <StatCard label="THREAT_LEVEL" value="LOW" color="text-[var(--accent-olive)]" />
                                <StatCard label="LOYALTY_INDEX" value="HIGH" color="text-white" />
                                <StatCard label="AFFILIATION" value="PARASITE_CORP" color="text-white/40" />
                            </div>

                            <div className="glass-panel p-8 border-white/5 relative overflow-hidden min-h-full">

                                <div className="flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
                                    <Terminal size={14} className="text-[var(--accent-olive)]" />
                                    <div className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/40">Neural Analysis Report</div>
                                </div>

                                {generating ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-6">
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-6 bg-[var(--accent-olive)] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                            <div className="w-1.5 h-6 bg-[var(--accent-olive)] animate-bounce" style={{ animationDelay: '100ms' }}></div>
                                            <div className="w-1.5 h-6 bg-[var(--accent-olive)] animate-bounce" style={{ animationDelay: '200ms' }}></div>
                                        </div>
                                        <div className="text-[10px] mono text-[var(--accent-olive)] animate-pulse tracking-widest">INTERROGATING_DATABASE...</div>
                                    </div>
                                ) : insights ? (
                                    <div className="prose prose-invert max-w-none prose-sm prose-headings:text-[var(--accent-olive)] prose-headings:uppercase prose-headings:tracking-widest prose-headings:font-black prose-p:text-white/70 prose-p:leading-relaxed mono-text">
                                        <ReactMarkdown>{insights}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-center opacity-20">
                                        <Brain size={48} className="mb-4" />
                                        <p className="text-[10px] font-bold tracking-[0.2em] uppercase">No neural data available. Initialize analysis.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-20">
                        <User size={64} className="mb-4" />
                        <p className="text-[10px] font-bold tracking-[0.2em] uppercase">Select a subject to begin profiling</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
    return (
        <div className="glass-panel p-6 border-white/5 bg-white/[0.01]">
            <div className="text-[8px] font-bold tracking-[0.3em] uppercase text-white/20 mb-2">{label}</div>
            <div className={`text-xl font-black tracking-widest uppercase ${color}`}>{value}</div>
        </div>
    );
}
