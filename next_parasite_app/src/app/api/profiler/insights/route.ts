import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { cacheGet, cacheSet } from '@/lib/cache';
import OpenAI from 'openai';

const LLM_BASE_URL = 'http://localhost:1234/v1';
const LLM_MODEL    = 'google/gemma-4-e2b';
const INSIGHTS_TTL = 24 * 60 * 60 * 1000; // 24h — insights are expensive, cache aggressively

// Simple per-user lock to prevent duplicate LLM calls for the same user
const activeLLMCalls = new Set<string>();

// Ensure the user_insights table exists — run once at startup, not per-request
const DB_INIT_DONE_KEY = 'db:insights_table_init';
async function ensureInsightsTable() {
    if (cacheGet(DB_INIT_DONE_KEY)) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_insights (
            username    VARCHAR PRIMARY KEY,
            insights    TEXT NOT NULL,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    cacheSet(DB_INIT_DONE_KEY, true, 60 * 60 * 1000); // remember for 1h
}

const SYSTEM_PROMPT = `
You are a highly advanced profiler and psychologist for a digital community.
Your goal is to provide deep insights about a user based on their chat history and extracted knowledge graph relations.

KNOWLEDGE CONTEXT FOR THE COMMUNITY:
- community is for people who want to be rich
- zouhir is the host of the stream
- parasite is someone who works online but not super professional
- dragonball is a successful parasite
- yajoura means brick used in this community to describe consistency and hard work (brick by brick)
- mauritania is used as an alias when they want to talk about morocco
- dela7 means watermelon and is used as a synonym for women in multiple ways not derogatory
- subhuman means someone who doesn't make money or isn't a channel member
- labubu means burnout in this community
- HMH is a greeting used in this community (health money heaven)

Provide a comprehensive analysis including:
1. PERSONALITY & VIBE: What is their general attitude? Are they helpful, toxic, ambitious, or just a lurker?
2. COMMUNITY STANDING: How do others interact with them? What is their role/reputation?
3. TECHNICAL/PROFESSIONAL INTERESTS: What tools, topics, or goals do they frequently mention?
4. NOTABLE BEHAVIORS: Any recurring patterns, specific catchphrases, or significant moments?
5. "PARASITE" RATING: Based on the community slang, how much of a 'parasite' are they (and why)?

Format your response in Markdown with clear headings and a professional, yet slightly "intelligence agency" tone, report in english.
`.trim();

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const userName: string | undefined = body?.userName;

    if (!userName || typeof userName !== 'string') {
        return NextResponse.json({ error: 'userName is required' }, { status: 400 });
    }

    // Sanitize — reject names that look like SQL injection attempts
    if (userName.length > 100) {
        return NextResponse.json({ error: 'userName too long' }, { status: 400 });
    }

    try {
        await ensureInsightsTable();

        // 1. Check DB cache first
        const cached = await query<{ insights: string }>(
            'SELECT insights FROM user_insights WHERE username = $1',
            [userName]
        );
        if (cached.length > 0) {
            return NextResponse.json({ insights: cached[0].insights, cached: true });
        }

        // 2. Deduplicate concurrent LLM calls for the same user
        if (activeLLMCalls.has(userName)) {
            return NextResponse.json(
                { error: 'Analysis already in progress for this user. Please wait.' },
                { status: 429 }
            );
        }
        activeLLMCalls.add(userName);

        try {
            // 3. Fetch context — both queries run in parallel
            const [messages, triplets] = await Promise.all([
                query<{ message: string; timestamp: string; purchase_amount: string | null }>(
                    'SELECT message, timestamp, purchase_amount FROM chat_messages WHERE author_name = $1 ORDER BY timestamp ASC',
                    [userName]
                ),
                query<{ subject: string; relation: string; object: string }>(
                    'SELECT subject, relation, object FROM extracted_triplets WHERE subject = $1 OR object = $1',
                    [userName]
                ),
            ]);

            const messageContext = messages
                .map(m => `${m.message}${m.purchase_amount ? ` [DONATION: ${m.purchase_amount}]` : ''}`)
                .join('\n');
            const tripletContext = triplets
                .map(t => `${t.subject} ${t.relation} ${t.object}`)
                .join('\n');

            // 4. Call LM Studio
            const client = new OpenAI({ baseURL: LLM_BASE_URL, apiKey: 'not-needed' });
            const response = await client.chat.completions.create({
                model: LLM_MODEL,
                messages: [
                    { role: 'system', content: `${SYSTEM_PROMPT}\n\nUSER PROFILE TO ANALYZE: ${userName}` },
                    { role: 'user', content: `### EXTRACTED RELATIONS:\n${tripletContext}\n\n### CHAT LOGS:\n${messageContext}` },
                ],
                temperature: 0.7,
            });

            const insights = response.choices[0].message.content ?? '';

            // 5. Persist to DB cache using UPSERT
            await pool.query(
                'INSERT INTO user_insights (username, insights) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET insights = EXCLUDED.insights, created_at = NOW()',
                [userName, insights]
            );

            return NextResponse.json({ insights, cached: false });
        } finally {
            activeLLMCalls.delete(userName);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Profiler Insights API Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
