import duckdb
import json
import networkx as nx
import sys
import math
import community.community_louvain as louvain
from config import DB_PATH, OUTPUT_HTML

# Configure output encoding for Windows terminal
sys.stdout.reconfigure(encoding='utf-8')

def main():
    print("🎨 Initializing Graph Visualizer (Palantir Edition)...")
    con = duckdb.connect(DB_PATH)
    
    # 1. Load data and identify node types
    print("📥 Loading triplets from database...")
    G = nx.Graph()
    
    def clean_name(name):
        if not name: return ""
        return name.strip().lower().lstrip('@')

    # Get all authors to identify user nodes (strip @ for matching)
    authors_raw = con.execute("SELECT DISTINCT author_name FROM chat_messages").fetchall()
    authors_clean = {clean_name(row[0]) for row in authors_raw}
    # Map clean names to original author names for better labels
    canonical_names = {clean_name(row[0]): row[0] for row in authors_raw}
    
    def get_node_type(name):
        if not name: return "topic"
        clean = clean_name(name)
        if clean in authors_clean: return "user"
        
        # Location keywords
        if any(kw in clean for kw in ['house', 'building', 'street', 'city', 'country', 'facility', 'camp', 'safehouse', 'base', 'location']):
            return "location"
        # Document keywords
        if any(kw in clean for kw in ['report', 'document', 'file', 'roster', 'list', 'collection', 'dataset', 'aar', 'sigint', 'evidence']):
            return "document"
        # Communication
        if any(kw in clean for kw in ['phone', 'call', 'number', 'contact', 'intercept', 'radio']):
            return "phone"
        
        return "topic"

    def get_node_style(node_type):
        palantir_red = "#ff4d4d"
        styles = {
            "user": {"icon": "👤", "color": palantir_red},
            "location": {"icon": "📍", "color": palantir_red},
            "document": {"icon": "📄", "color": palantir_red},
            "phone": {"icon": "📞", "color": palantir_red},
            "topic": {"icon": "🏷️", "color": palantir_red}
        }
        return styles.get(node_type, {"icon": "🏷️", "color": palantir_red})

    triplets = con.execute("SELECT subject, relation, object FROM extracted_triplets").fetchall()
    
    # Pre-process nodes to merge duplicates
    for s, r, o in triplets:
        if s is None or o is None: continue
        
        # Normalize names for merging
        s_clean = clean_name(s)
        o_clean = clean_name(o)
        
        # Use canonical name if available, otherwise use original
        s_label = canonical_names.get(s_clean, s)
        o_label = canonical_names.get(o_clean, o)
        
        s_type = get_node_type(s_label)
        o_type = get_node_type(o_label)
        
        s_style = get_node_style(s_type)
        o_style = get_node_style(o_type)
        
        # Add nodes (networkx handles duplicates by default if keys are same)
        G.add_node(s_clean, label=s_label, type=s_type, icon=s_style["icon"], color=s_style["color"])
        G.add_node(o_clean, label=o_label, type=o_type, icon=o_style["icon"], color=o_style["color"])
        G.add_edge(s_clean, o_clean, label=r)
    
    if G.number_of_nodes() == 0:
        print("❌ No data found in 'extracted_triplets' table.")
        return

    # 2. Community Detection
    print("🔍 Detecting communities...")
    try:
        partition = louvain.best_partition(G)
        nx.set_node_attributes(G, partition, 'group')
    except Exception as e:
        print(f"⚠️ Community detection failed: {e}")
        nx.set_node_attributes(G, 0, 'group')

    # 3. Generate ForceGraph HTML
    print(f"🎨 Generating Palantir-style visualization: {OUTPUT_HTML}...")
    
    nodes = []
    for n, data in G.nodes(data=True):
        degree = G.degree(n)
        size = 4 + math.log(degree + 1) * 3
        
        # Get connections for the sidebar and for highlighting in JS
        neighbors = []
        neighbor_ids = []
        for neighbor in G.neighbors(n):
            edge_data = G.get_edge_data(n, neighbor)
            neighbor_ids.append(str(neighbor))
            neighbors.append({
                "id": str(neighbor),
                "name": G.nodes[neighbor].get("label", str(neighbor)),
                "relation": edge_data.get("label", "RELATED_TO")
            })

        nodes.append({
            "id": str(n),
            "name": data.get("label", str(n)),
            "group": data.get("group", 0),
            "type": data.get("type", "topic"),
            "icon": data.get("icon", "🏷️"),
            "color": data.get("color", "#38bdf8"),
            "val": size,
            "degree": degree,
            "links": neighbors,
            "neighborIds": neighbor_ids
        })
    
    links = []
    for u, v, data in G.edges(data=True):
        links.append({
            "source": str(u),
            "target": str(v),
            "relation": data.get("label", "RELATED_TO")
        })
    
    data_json = json.dumps({"nodes": nodes, "links": links})
    
    html_template = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Parasite | Intelligence Graph</title>
    <script src="https://unpkg.com/force-graph"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-dark: #0a0b0a;
            --bg-sidebar: #161a14;
            --accent-red: #ff4d4d;
            --accent-olive: #acc66a;
            --text-main: #e0e0e0;
            --text-dim: #888;
            --border: rgba(172, 198, 106, 0.2);
        }}
        body, html {{ margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: var(--bg-dark); font-family: 'Inter', sans-serif; color: var(--text-main); }}
        
        #app {{ display: flex; flex-direction: column; width: 100vw; height: 100vh; }}
        
        #header {{
            height: 50px;
            background: #1a1c1a;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            padding: 0 20px;
            justify-content: space-between;
            z-index: 100;
        }}
        .logo {{ font-weight: 600; font-size: 1.2rem; color: var(--accent-olive); display: flex; align-items: center; gap: 10px; }}
        .nav {{ display: flex; gap: 30px; font-size: 0.85rem; letter-spacing: 1px; color: var(--text-dim); }}
        .nav-item.active {{ color: var(--accent-olive); border-bottom: 2px solid var(--accent-olive); height: 48px; line-height: 48px; }}
        
        #main-content {{ display: flex; flex: 1; overflow: hidden; }}
        #graph-container {{ flex: 1; position: relative; }}
        
        #sidebar {{
            width: 380px;
            background: var(--bg-sidebar);
            border-left: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            padding: 25px;
            box-shadow: -5px 0 15px rgba(0,0,0,0.5);
            z-index: 90;
        }}
        
        .sidebar-placeholder {{ display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-dim); text-align: center; }}
        .sidebar-placeholder i {{ font-size: 3rem; margin-bottom: 15px; opacity: 0.3; }}
        
        .detail-header {{ border-bottom: 1px solid var(--border); padding-bottom: 15px; margin-bottom: 20px; }}
        .node-type {{ font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-olive); margin-bottom: 5px; }}
        .node-name {{ font-size: 1.6rem; font-weight: 600; color: #fff; line-height: 1.2; }}
        
        .section-title {{ font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); margin: 20px 0 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px; }}
        .property {{ display: flex; flex-direction: column; margin-bottom: 12px; }}
        .prop-label {{ font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; }}
        .prop-value {{ font-size: 0.95rem; color: var(--accent-olive); }}
        
        .link-item {{ display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 0.85rem; }}
        .link-rel {{ color: var(--text-dim); font-style: italic; min-width: 80px; }}
        .link-target {{ color: #fff; cursor: pointer; }}
        .link-target:hover {{ text-decoration: underline; color: var(--accent-olive); }}
        
        #controls {{ position: absolute; bottom: 20px; left: 20px; display: flex; gap: 10px; pointer-events: none; }}
        .control-btn {{ pointer-events: auto; background: rgba(26, 28, 26, 0.8); border: 1px solid var(--border); color: #fff; width: 36px; height: 36px; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; }}
        .control-btn:hover {{ background: var(--accent-olive); color: #000; }}

        .legend {{ background: rgba(22, 26, 20, 0.8); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-top: auto; }}
        .legend-item {{ display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 0.75rem; }}
        .legend-dot {{ width: 10px; height: 10px; border-radius: 50%; }}
        
        ::-webkit-scrollbar {{ width: 6px; }}
        ::-webkit-scrollbar-track {{ background: transparent; }}
        ::-webkit-scrollbar-thumb {{ background: var(--border); border-radius: 3px; }}
    </style>
</head>
<body>
    <div id="app">
        <header id="header">
            <div class="logo">PARASITE Intelligence</div>
            <div class="nav">
                <div class="nav-item">SEARCH</div>
                <div class="nav-item">MAP</div>
                <div class="nav-item active">GRAPH</div>
                <div class="nav-item">FILES</div>
            </div>
            <div style="color: var(--text-dim); font-size: 0.8rem;">LOGOUT</div>
        </header>
        
        <div id="main-content">
            <div id="graph-container">
                <div id="controls">
                    <div class="control-btn" title="Zoom In" onclick="zoom(1.5)">+</div>
                    <div class="control-btn" title="Zoom Out" onclick="zoom(0.5)">-</div>
                    <div class="control-btn" title="Reset View" onclick="resetView()">⟲</div>
                </div>
            </div>
            
            <aside id="sidebar">
                <div id="sidebar-inner" style="flex: 1; display: flex; flex-direction: column;">
                    <div id="sidebar-content" class="sidebar-placeholder">
                        <i>🔍</i>
                        <p>Select a node to view intelligence details</p>
                    </div>

                    <div class="legend">
                        <div class="section-title" style="margin-top: 0;">Intelligence Legend</div>
                        <div class="legend-item"><div class="legend-dot" style="background: #ff4d4d;"></div> 👤 Person / User</div>
                        <div class="legend-item"><div class="legend-dot" style="background: #ff4d4d;"></div> 🏷️ Topic / Concept</div>
                        <div class="legend-item"><div class="legend-dot" style="background: #ff4d4d;"></div> 📍 Location / Site</div>
                        <div class="legend-item"><div class="legend-dot" style="background: #ff4d4d;"></div> 📄 Document / Report</div>
                        <div class="legend-item"><div class="legend-dot" style="background: #ff4d4d;"></div> 📞 Phone / Communication</div>
                    </div>
                </div>
            </aside>
        </div>
    </div>

    <script>
        const gData = {data_json};
        let selectedNode = null;
        let hoverNode = null;
        const highlightNodes = new Set();
        const highlightLinks = new Set();

        const Graph = ForceGraph()(document.getElementById('graph-container'));

        Graph.graphData(gData)
            .nodeId('id')
            .nodeVal('val')
            .backgroundColor('#0a0b0a')
            .linkColor(link => highlightLinks.has(link) ? 'rgba(255, 77, 77, 0.8)' : 'rgba(172, 198, 106, 0.08)')
            .linkWidth(link => highlightLinks.has(link) ? 3 : 1)
            .linkDirectionalParticles(link => highlightLinks.has(link) ? 4 : 0)
            .linkDirectionalParticleWidth(2)
            .nodeCanvasObject((node, ctx, globalScale) => {{
                const r = node.val;
                const isSelected = selectedNode && selectedNode.id === node.id;
                const isHovered = hoverNode && hoverNode.id === node.id;
                const isHighlighted = highlightNodes.has(node.id);
                const isDimmed = (selectedNode || hoverNode) && !isHighlighted && !isHovered;
                
                const isVerySmall = globalScale < 0.5;
                const isSmall = globalScale < 1.5;

                if (isSelected || isHovered) {{
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, r + 4 / globalScale, 0, 2 * Math.PI, false);
                    ctx.strokeStyle = isSelected ? '#f1c40f' : '#acc66a';
                    ctx.lineWidth = 4 / globalScale;
                    ctx.stroke();
                }}

                ctx.beginPath();
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                ctx.fillStyle = node.color || '#38bdf8';
                if (isDimmed) ctx.globalAlpha = 0.1;
                ctx.fill();
                
                if (!isVerySmall || isHighlighted || isHovered) {{
                    ctx.strokeStyle = (isHighlighted || isHovered) ? '#fff' : 'rgba(255, 255, 255, 0.2)';
                    ctx.lineWidth = (isHighlighted || isHovered ? 2 : 1) / globalScale;
                    ctx.stroke();
                }}

                if (!isSmall || isHighlighted || isSelected || isHovered) {{
                    const fontSize = r * 1.2;
                    ctx.font = `${{fontSize}}px serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(node.icon, node.x, node.y);
                }}

                // Draw label if zoomed in, highlighted, OR hovered
                if (globalScale > 2.5 || (isHighlighted && globalScale > 0.8) || isHovered) {{
                    const label = node.name;
                    const textFontSize = (isHighlighted || isHovered ? 14 : 10) / globalScale;
                    ctx.font = `${{textFontSize}}px 'Inter'`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = (isHighlighted || isHovered) ? '#fff' : 'rgba(255, 255, 255, 0.5)';
                    ctx.fillText(label, node.x, node.y + r + 2);
                }}
                ctx.globalAlpha = 1.0;
            }})
            .onNodeHover(node => {{
                if (node === hoverNode) return;
                hoverNode = node || null;
                updateHighlight();
            }})
            .onNodeClick(node => {{
                selectedNode = node;
                updateSidebar(node);
                Graph.centerAt(node.x, node.y, 800);
                Graph.zoom(4, 800);

                highlightNodes.clear();
                highlightLinks.clear();
                highlightNodes.add(node.id);
                node.neighborIds.forEach(neighborId => highlightNodes.add(neighborId));
                gData.links.forEach(link => {{
                    if (link.source.id === node.id || link.target.id === node.id) highlightLinks.add(link);
                }});
                updateHighlight();
            }})
            .onBackgroundClick(() => {{
                selectedNode = null;
                highlightNodes.clear();
                highlightLinks.clear();
                resetSidebar();
                updateHighlight();
            }})
            .cooldownTicks(100)
            .d3VelocityDecay(0.3);

        function updateHighlight() {{
            Graph
                .nodeCanvasObject(Graph.nodeCanvasObject())
                .linkColor(Graph.linkColor())
                .linkWidth(Graph.linkWidth())
                .linkDirectionalParticles(Graph.linkDirectionalParticles());
        }}

        function updateSidebar(node) {{
            const content = document.getElementById('sidebar-content');
            content.className = '';
            
            let linksHtml = node.links.map(l => `
                <div class="link-item">
                    <span class="link-rel">${{l.relation}}</span>
                    <span class="link-target" onclick="focusNode('${{l.id}}')">${{l.name}}</span>
                </div>
            `).join('');

            content.innerHTML = `
                <div class="detail-header">
                    <div class="node-type" style="color: ${{node.color}}">${{node.type}}</div>
                    <div class="node-name">${{node.name}}</div>
                </div>
                
                <div class="section-title">Properties</div>
                <div class="property">
                    <span class="prop-label">Connections</span>
                    <span class="prop-value">${{node.degree}} direct links</span>
                </div>
                <div class="property">
                    <span class="prop-label">Intelligence Group</span>
                    <span class="prop-value">Cluster ${{node.group}}</span>
                </div>

                <div class="section-title">Associated Links</div>
                <div class="links-list">
                    ${{linksHtml || '<div class="text-dim">No links found</div>'}}
                </div>
            `;
        }}

        function resetSidebar() {{
            const content = document.getElementById('sidebar-content');
            content.className = 'sidebar-placeholder';
            content.innerHTML = `
                <i>🔍</i>
                <p>Select a node to view intelligence details</p>
            `;
        }}

        function focusNode(id) {{
            const node = gData.nodes.find(n => n.id === id);
            if (node) {{
                selectedNode = node;
                updateSidebar(node);
                Graph.centerAt(node.x, node.y, 800);
                Graph.zoom(4, 800);
                
                highlightNodes.clear();
                highlightLinks.clear();
                highlightNodes.add(node.id);
                node.neighborIds.forEach(neighborId => highlightNodes.add(neighborId));
                gData.links.forEach(link => {{
                    if (link.source.id === node.id || link.target.id === node.id) {{
                        highlightLinks.add(link);
                    }}
                }});
                updateHighlight();
            }}
        }}

        function zoom(factor) {{
            Graph.zoom(Graph.zoom() * factor, 400);
        }}

        function resetView() {{
            Graph.zoomToFit(800);
        }}

        Graph.d3Force('collide', d3.forceCollide(node => node.val + 5));
    </script>
</body>
</html>
    """
    
    with open(OUTPUT_HTML, 'w', encoding='utf-8') as f:
        f.write(html_template)
    
    print(f"✨ Intelligence Graph updated successfully! Open {OUTPUT_HTML}")

if __name__ == "__main__":
    main()
