"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as d3 from 'd3';

// Dynamic import for client-side only component
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface Node {
  id: string;
  name: string;
  val: number;
  type: string;
  icon: string;
  color: string;
  degree: number;
  neighborIds: string[];
  links: any[];
  x?: number;
  y?: number;
}

interface Link {
  source: any;
  target: any;
  relation: string;
}

interface Props {
  data: { nodes: Node[]; links: Link[] };
  onNodeSelect: (node: Node | null) => void;
  selectedNode: Node | null;
}

export default function IntelligenceGraph({ data, onNodeSelect, selectedNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoverNode, setHoverNode] = useState<Node | null>(null);
  
  // Stable Resize Handler
  useEffect(() => {
    if (!containerRef.current) return;
    
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        handleResize();
      });
    });

    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Memoize highlight sets
  const { highlightNodes, highlightLinks } = useMemo(() => {
    const nodes = new Set<string>();
    const links = new Set<Link>();
    
    if (selectedNode) {
      nodes.add(selectedNode.id);
      selectedNode.neighborIds?.forEach(id => nodes.add(id));
      data.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        if (sourceId === selectedNode.id || targetId === selectedNode.id) links.add(link);
      });
    }
    
    return { highlightNodes: nodes, highlightLinks: links };
  }, [selectedNode, data.links]);

  useEffect(() => {
    if (selectedNode && graphRef.current) {
      setTimeout(() => {
        if (selectedNode.x !== undefined && selectedNode.y !== undefined) {
          graphRef.current.centerAt(selectedNode.x, selectedNode.y, 800);
          graphRef.current.zoom(4, 800);
        }
      }, 100);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('collide', d3.forceCollide((node: any) => node.val + 8));
      graphRef.current.d3Force('charge', d3.forceManyBody().strength(-150));
    }
  }, [data]);

  const handleNodeClick = useCallback((node: Node) => {
    onNodeSelect(node);
  }, [onNodeSelect]);

  const handleBackgroundClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  const handleNodeHover = useCallback((node: Node | null) => {
    setHoverNode(node);
  }, []);

  const paintNode = useCallback((node: Node, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = node.val;
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoverNode?.id === node.id;
    const isHighlighted = highlightNodes.has(node.id);
    const isDimmed = (selectedNode || hoverNode) && !isHighlighted && !isHovered;

    const isVerySmall = globalScale < 0.5;
    const isSmall = globalScale < 1.5;

    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, r + 6 / globalScale, 0, 2 * Math.PI, false);
      ctx.strokeStyle = isSelected ? '#fadb14' : '#b5e853';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();

      if (!isVerySmall) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = isSelected ? 'rgba(250, 219, 20, 0.5)' : 'rgba(181, 232, 83, 0.4)';
      }
    }

    ctx.beginPath();
    ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI, false);
    
    if (isDimmed) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#222';
    } else {
        ctx.fillStyle = '#ff4d4f'; 
    }
    
    ctx.fill();
    ctx.shadowBlur = 0;

    if (!isVerySmall) {
      ctx.strokeStyle = (isSelected || isHovered) ? '#fff' : 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    if (!isSmall || isHighlighted || isSelected || isHovered) {
      const fontSize = r * 1.1;
      ctx.font = `${fontSize}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      if (isDimmed) ctx.globalAlpha = 0.2;
      ctx.fillText(node.icon, node.x!, node.y!);
    }

    if (globalScale > 2.2 || (isHighlighted && globalScale > 0.6) || isHovered) {
      const textFontSize = (isSelected || isHovered ? 14 : 11) / globalScale;
      ctx.font = `${isSelected || isHovered ? '600' : '400'} ${textFontSize}px 'Inter'`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      
      ctx.fillStyle = (isHighlighted || isHovered) ? '#fff' : 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(node.name, node.x!, node.y! + r + 3);
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1.0;
  }, [selectedNode, hoverNode, highlightNodes]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ width: '100%', height: '100%' }}>
      {dimensions.width > 0 && (
        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={data}
          nodeId="id"
          nodeVal="val"
          backgroundColor="transparent"
          linkColor={link => {
              const isHighlighted = highlightLinks.has(link as Link);
              return isHighlighted ? 'rgba(250, 219, 20, 0.6)' : 'rgba(255, 255, 255, 0.05)';
          }}
          linkWidth={link => highlightLinks.has(link as Link) ? 2 : 0.5}
          linkDirectionalParticles={link => highlightLinks.has(link as Link) ? 3 : 0}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={0.005}
          nodeCanvasObject={paintNode as any}
          onNodeClick={handleNodeClick as any}
          onNodeHover={handleNodeHover as any}
          onBackgroundClick={handleBackgroundClick}
          cooldownTicks={150}
          d3VelocityDecay={0.4}
        />
      )}
      
      {/* Controls Container */}
      <div className="absolute flex flex-col gap-2" style={{ bottom: '32px', left: '32px', pointerEvents: 'none' }}>
        <GraphControl 
          onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 400)}
          label="+"
        />
        <GraphControl 
          onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 0.7, 400)}
          label="-"
        />
        <GraphControl 
          onClick={() => graphRef.current?.zoomToFit(800)}
          label="⟲"
        />
      </div>
    </div>
  );
}

function GraphControl({ onClick, label }: { onClick: () => void, label: string }) {
  return (
    <button 
      className="flex items-center justify-center transition-all hover:scale-110 active:scale-95"
      onClick={onClick}
      style={{ 
          pointerEvents: 'auto', 
          width: '36px', 
          height: '36px', 
          borderRadius: '8px', 
          color: 'var(--text-main)', 
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(8px)',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}
    >
      <span style={{ fontSize: '20px', fontWeight: 300, opacity: 0.7 }}>{label}</span>
    </button>
  );
}
