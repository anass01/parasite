import React from 'react';
import { Search, User, MapPin, FileText, Phone, Tag, Info, Share2, MoreHorizontal, ExternalLink, X } from 'lucide-react';

interface Node {
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
}

interface SidebarProps {
  selectedNode: Node | null;
  allNodes: Node[];
  onNodeSelect: (node: Node | null) => void;
}

export default function Sidebar({ selectedNode, allNodes, onNodeSelect }: SidebarProps) {
  const handleLinkClick = (nodeId: string) => {
    const targetNode = allNodes.find(n => n.id === nodeId);
    if (targetNode) {
      onNodeSelect(targetNode);
    }
  };

  const formatTimestamp = (ts: string | null | undefined) => {
    if (!ts) return "UNKNOWN";
    try {
      const date = new Date(ts);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).toUpperCase();
    } catch (e) {
      return ts.toUpperCase();
    }
  };

  return (
    <aside className="h-full glass-panel flex flex-col overflow-hidden" style={{ width: '420px', maxWidth: '100vw', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
      {!selectedNode ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center" style={{ color: 'var(--text-dim)' }}>
          <div className="w-20 h-20 flex items-center justify-center mb-6" style={{ borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }}>
            <Search size={32} style={{ opacity: 0.2 }} />
          </div>
          <p className="text-xs tracking-widest uppercase font-medium opacity-40">No Intelligence Selected</p>
        </div>
      ) : (
        <>
          {/* Sidebar Header - Fixed at top */}
          <div className="shrink-0 p-8 pb-6 relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
            <button
              onClick={() => onNodeSelect(null)}
              className="absolute"
              style={{ top: '16px', right: '16px', color: 'rgba(255,255,255,0.2)', background: 'transparent', border: 'none', cursor: 'pointer', zIndex: 10 }}
            >
              <X size={18} />
            </button>

            <div className="flex justify-between items-start mb-6" style={{ paddingRight: '32px' }}>
              <div className="px-2 py-1 text-xs font-bold tracking-widest uppercase" style={{ borderRadius: '4px', background: 'rgba(181, 232, 83, 0.1)', color: 'var(--accent-olive)' }}>
                {selectedNode.type}
              </div>
              <div className="flex gap-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                <Share2 size={14} className="cursor-pointer" />
                <MoreHorizontal size={14} className="cursor-pointer" />
              </div>
            </div>

            <h2 className="text-3xl font-bold mb-2" style={{ color: 'white' }}>
              {selectedNode.name}
            </h2>

            <div className="flex items-center gap-4 text-xs font-medium tracking-widest" style={{ color: 'var(--text-dim)' }}>
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[var(--accent-olive)]" style={{ borderRadius: '50%' }}></div> VERIFIED</span>
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-white" style={{ borderRadius: '50%', opacity: 0.2 }}></div> ID: {selectedNode.id.split('-')[0]}</span>
            </div>
          </div>

          {/* Properties & Associations Section - Scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-6 min-h-0">
            <section style={{ marginBottom: '40px' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-dim)', marginBottom: '16px' }}>
                <Info size={12} /> PROPERTIES
              </h3>
              <div className="flex flex-col gap-4">
                <Property label="NAME" value={selectedNode.name} />
                <Property label="CONNECTIONS" value={`${selectedNode.degree} DIRECT LINKS`} highlight />
                <Property label="ENTITY ID" value={selectedNode.id} mono />
                {selectedNode.type === "user" && (
                  <Property label="LAST SEEN" value={formatTimestamp(selectedNode.lastSeen)} />
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                ASSOCIATED INTELLIGENCE
              </h3>
              <div className="flex flex-col gap-2">
                {selectedNode.links.length > 0 ? (
                  selectedNode.links.map((link, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 transition-all cursor-pointer hover-bg"
                      onClick={() => handleLinkClick(link.id)}
                      style={{ borderRadius: '6px', border: '1px solid transparent' }}
                    >
                      <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {link.relation.toLowerCase().includes('phone') ? <Phone size={12} /> :
                            link.relation.toLowerCase().includes('loc') ? <MapPin size={12} /> :
                              link.relation.toLowerCase().includes('doc') ? <FileText size={12} /> :
                                <ExternalLink size={12} />}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="uppercase font-bold tracking-widest" style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{link.relation}</span>
                        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>{link.name}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                    <p className="text-xs italic" style={{ color: 'var(--text-dim)' }}>No direct associations indexed.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Footer Legend - Fixed at bottom */}
          <div className="shrink-0 px-2 py-6" style={{ background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex flex-wrap gap-4">
              <LegendItem color="#ff4d4f" icon={<User size={10} />} label="PERSON" />
              <LegendItem color="#ff4d4f" icon={<Tag size={10} />} label="TOPIC" />
              <LegendItem color="#ff4d4f" icon={<MapPin size={10} />} label="LOCATION" />
              <LegendItem color="#ff4d4f" icon={<FileText size={10} />} label="DOCUMENT" />
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

function Property({ label, value, highlight = false, mono = false }: { label: string, value: string, highlight?: boolean, mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-bold tracking-widest" style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{label}</span>
      <span
        className={`text-sm ${mono ? 'mono' : ''}`}
        style={{ color: highlight ? 'var(--accent-olive)' : 'rgba(255,255,255,0.8)' }}
        suppressHydrationWarning
      >
        {value}
      </span>
    </div>
  );
}

function LegendItem({ color, icon, label }: { color: string, icon: React.ReactNode, label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>
      <div className="w-1.5 h-1.5" style={{ backgroundColor: color, borderRadius: '50%' }}></div>
      <span style={{ opacity: 0.6 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
