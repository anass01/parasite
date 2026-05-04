import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cachedQuery } from '@/lib/cache';

const GRAPH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface AuthorRow {
    author_name: string;
    last_seen: string;
}

interface TripletRow {
    subject: string;
    relation: string;
    object: string;
}

const cleanName = (name: string): string => {
    if (!name) return '';
    return name.trim().toLowerCase().replace(/^@/, '');
};

const LOCATION_KW = ['house', 'building', 'street', 'city', 'country', 'facility', 'camp', 'safehouse', 'base', 'location'];
const DOCUMENT_KW = ['report', 'document', 'file', 'roster', 'list', 'collection', 'dataset', 'aar', 'sigint', 'evidence'];
const PHONE_KW    = ['phone', 'call', 'number', 'contact', 'intercept', 'radio'];

const getNodeType = (name: string, authorsData: Map<string, { lastSeen: string; originalName: string }>): string => {
    const clean = cleanName(name);
    if (authorsData.has(clean)) return 'user';
    const lower = clean.toLowerCase();
    if (LOCATION_KW.some(kw => lower.includes(kw))) return 'location';
    if (DOCUMENT_KW.some(kw => lower.includes(kw))) return 'document';
    if (PHONE_KW.some(kw => lower.includes(kw))) return 'phone';
    return 'topic';
};

const NODE_STYLES: Record<string, { icon: string; color: string }> = {
    user:     { icon: '👤', color: '#ff4d4d' },
    location: { icon: '📍', color: '#ff4d4d' },
    document: { icon: '📄', color: '#ff4d4d' },
    phone:    { icon: '📞', color: '#ff4d4d' },
    topic:    { icon: '🏷️', color: '#ff4d4d' },
};

async function buildGraphData() {
    const [authorsRaw, triplets] = await Promise.all([
        query<AuthorRow>(
            'SELECT author_name, MAX(timestamp) as last_seen FROM chat_messages GROUP BY author_name'
        ),
        query<TripletRow>('SELECT subject, relation, object FROM extracted_triplets'),
    ]);

    const authorsData = new Map<string, { lastSeen: string; originalName: string }>();
    const canonicalNames = new Map<string, string>();

    for (const row of authorsRaw) {
        const clean = cleanName(row.author_name);
        authorsData.set(clean, { lastSeen: row.last_seen, originalName: row.author_name });
        canonicalNames.set(clean, row.author_name);
    }

    const nodesMap = new Map<string, {
        id: string; name: string; type: string; icon: string; color: string;
        val: number; degree: number; neighborIds: Set<string>;
        links: { id: string; name: string; relation: string }[];
        lastSeen: string | null;
    }>();
    const links: { source: string; target: string; relation: string }[] = [];

    const ensureNode = (rawName: string) => {
        const clean = cleanName(rawName);
        if (nodesMap.has(clean)) return clean;
        const label = canonicalNames.get(clean) ?? rawName;
        const type  = getNodeType(label, authorsData);
        const style = NODE_STYLES[type] ?? NODE_STYLES.topic;
        nodesMap.set(clean, {
            id: clean, name: label, type,
            icon: style.icon, color: style.color,
            val: 1, degree: 0,
            neighborIds: new Set(),
            links: [],
            lastSeen: authorsData.get(clean)?.lastSeen ?? null,
        });
        return clean;
    };

    for (const t of triplets) {
        const { subject, relation, object: obj } = t;
        if (!subject || !obj) continue;

        const sClean = ensureNode(subject);
        const oClean = ensureNode(obj);
        const sNode  = nodesMap.get(sClean)!;
        const oNode  = nodesMap.get(oClean)!;

        sNode.degree++;
        oNode.degree++;
        sNode.neighborIds.add(oClean);
        oNode.neighborIds.add(sClean);
        sNode.links.push({ id: oClean, name: oNode.name, relation });
        oNode.links.push({ id: sClean, name: sNode.name, relation });

        links.push({ source: sClean, target: oClean, relation });
    }

    const nodes = Array.from(nodesMap.values()).map(node => ({
        ...node,
        val: 4 + Math.log(node.degree + 1) * 3,
        neighborIds: Array.from(node.neighborIds),
    }));

    return { nodes, links };
}

export async function GET() {
    try {
        const data = await cachedQuery('graph:data', GRAPH_CACHE_TTL, buildGraphData);

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Graph API Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
