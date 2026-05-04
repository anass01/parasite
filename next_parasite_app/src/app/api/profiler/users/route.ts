import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cachedQuery } from '@/lib/cache';

const USERS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

interface UserRow {
    name: string;
    message_count: number;
    last_seen: string;
}

export async function GET() {
    try {
        const users = await cachedQuery('profiler:users', USERS_CACHE_TTL, () =>
            query<UserRow>(`
                SELECT
                    author_name AS name,
                    COUNT(*)::int AS message_count,
                    MAX(timestamp) AS last_seen
                FROM chat_messages
                GROUP BY author_name
                ORDER BY message_count DESC
            `)
        );

        return NextResponse.json(users, {
            headers: {
                'Cache-Control': 'public, max-age=120, stale-while-revalidate=30',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Profiler Users API Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
