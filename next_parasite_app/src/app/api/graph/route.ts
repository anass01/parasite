import { NextResponse } from 'next/server';
import duckdb from 'duckdb';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), '../db/chat.duckdb');

export async function GET() {
    // Open in READ_ONLY mode to allow multiple concurrent readers
    const db = new duckdb.Database(DB_PATH, { "access_mode": "READ_ONLY" });
    
    const query = (sql: string): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            db.all(sql, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    };

    try {
        const authorsRaw = await query("SELECT author_name, MAX(timestamp) as last_seen FROM chat_messages GROUP BY author_name");
        
        const cleanName = (name: string) => {
            if (!name) return "";
            return name.trim().toLowerCase().replace(/^@/, '');
        };

        const authorsData = new Map();
        const canonicalNames = new Map();
        
        authorsRaw.forEach(row => {
            const clean = cleanName(row.author_name);
            authorsData.set(clean, { 
                lastSeen: row.last_seen, 
                originalName: row.author_name 
            });
            canonicalNames.set(clean, row.author_name);
        });

        const triplets = await query("SELECT subject, relation, object FROM extracted_triplets");

        const nodesMap = new Map();
        const links: any[] = [];

        const getNodeType = (name: string) => {
            const clean = cleanName(name);
            if (authorsData.has(clean)) return "user";
            
            const lower = clean.toLowerCase();
            if (['house', 'building', 'street', 'city', 'country', 'facility', 'camp', 'safehouse', 'base', 'location'].some(kw => lower.includes(kw))) return "location";
            if (['report', 'document', 'file', 'roster', 'list', 'collection', 'dataset', 'aar', 'sigint', 'evidence'].some(kw => lower.includes(kw))) return "document";
            if (['phone', 'call', 'number', 'contact', 'intercept', 'radio'].some(kw => lower.includes(kw))) return "phone";
            
            return "topic";
        };

        const getStyle = (type: string) => {
            const styles: Record<string, any> = {
                "user": { icon: "👤", color: "#ff4d4d" },
                "location": { icon: "📍", color: "#ff4d4d" },
                "document": { icon: "📄", color: "#ff4d4d" },
                "phone": { icon: "📞", color: "#ff4d4d" },
                "topic": { icon: "🏷️", color: "#ff4d4d" }
            };
            return styles[type] || styles["topic"];
        };

        triplets.forEach(t => {
            const { subject, relation, object } = t;
            if (!subject || !object) return;

            const sClean = cleanName(subject);
            const oClean = cleanName(object);
            
            const sLabel = canonicalNames.get(sClean) || subject;
            const oLabel = canonicalNames.get(oClean) || object;

            if (!nodesMap.has(sClean)) {
                const type = getNodeType(sLabel);
                const style = getStyle(type);
                const aData = authorsData.get(sClean);
                
                nodesMap.set(sClean, {
                    id: sClean,
                    name: sLabel,
                    type,
                    icon: style.icon,
                    color: style.color,
                    val: 1,
                    degree: 0,
                    neighborIds: new Set(),
                    links: [],
                    lastSeen: aData ? aData.lastSeen : null
                });
            }

            if (!nodesMap.has(oClean)) {
                const type = getNodeType(oLabel);
                const style = getStyle(type);
                const aData = authorsData.get(oClean);
                
                nodesMap.set(oClean, {
                    id: oClean,
                    name: oLabel,
                    type,
                    icon: style.icon,
                    color: style.color,
                    val: 1,
                    degree: 0,
                    neighborIds: new Set(),
                    links: [],
                    lastSeen: aData ? aData.lastSeen : null
                });
            }

            const sNode = nodesMap.get(sClean);
            const oNode = nodesMap.get(oClean);

            sNode.degree++;
            oNode.degree++;
            sNode.neighborIds.add(oClean);
            oNode.neighborIds.add(sClean);
            
            sNode.links.push({ id: oClean, name: oLabel, relation });

            links.push({
                source: sClean,
                target: oClean,
                relation
            });
        });

        const nodes = Array.from(nodesMap.values()).map(node => ({
            ...node,
            val: 4 + Math.log(node.degree + 1) * 3,
            neighborIds: Array.from(node.neighborIds)
        }));

        return NextResponse.json({ nodes, links });
    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        db.close();
    }
}
